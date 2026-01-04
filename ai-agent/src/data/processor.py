"""Data processor for normalizing and preparing data for optimization."""

from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple
from dataclasses import dataclass
from decimal import Decimal
import numpy as np
import pandas as pd
import structlog

from .fetcher import StrategyMetrics, DataFetcher

logger = structlog.get_logger()


@dataclass
class ProcessedStrategy:
    """Processed strategy data ready for optimization."""
    strategy_id: str
    name: str
    expected_return: float  # Annualized
    volatility: float  # Annualized
    risk_score: float  # Normalized 0-1
    tvl_score: float  # Normalized 0-1
    age_score: float  # Normalized 0-1
    sharpe_ratio: float
    current_allocation: float
    min_allocation: float
    max_allocation: float


@dataclass
class OptimizationInput:
    """Input data for portfolio optimization."""
    strategies: List[ProcessedStrategy]
    correlation_matrix: np.ndarray
    risk_free_rate: float
    total_amount: Decimal


class DataProcessor:
    """Processes raw data into optimization-ready format."""

    def __init__(self, config: Dict[str, Any]):
        """Initialize data processor.

        Args:
            config: Configuration dictionary
        """
        self.config = config
        self.risk_config = config.get("risk", {})
        self.strategy_config = config.get("strategies", [])

    def process_strategy_metrics(
        self,
        metrics: List[StrategyMetrics],
        current_allocations: Optional[Dict[str, float]] = None
    ) -> List[ProcessedStrategy]:
        """Process raw strategy metrics into optimization format.

        Args:
            metrics: Raw strategy metrics
            current_allocations: Current allocation weights

        Returns:
            List of processed strategies
        """
        current_allocations = current_allocations or {}

        # Get min/max allocations from config
        allocation_limits = {
            s["id"]: (s.get("min_allocation", 0), s.get("max_allocation", 1))
            for s in self.strategy_config
        }

        processed = []
        for m in metrics:
            # Get allocation limits
            min_alloc, max_alloc = allocation_limits.get(
                m.strategy_id,
                (0.0, 1.0)
            )

            # Normalize risk score (0-100 to 0-1)
            risk_normalized = m.risk_score / 100.0

            # Calculate TVL score (higher TVL = higher score, with diminishing returns)
            tvl_score = self._calculate_tvl_score(m.tvl)

            # Calculate age score (older = more trustworthy)
            min_age = self.risk_config.get("min_protocol_age", 30)
            age_score = min(1.0, m.protocol_age_days / (min_age * 4))

            processed.append(ProcessedStrategy(
                strategy_id=m.strategy_id,
                name=m.name,
                expected_return=float(m.current_apy),
                volatility=float(m.volatility),
                risk_score=risk_normalized,
                tvl_score=tvl_score,
                age_score=age_score,
                sharpe_ratio=float(m.sharpe_ratio),
                current_allocation=current_allocations.get(m.strategy_id, 0.0),
                min_allocation=min_alloc,
                max_allocation=max_alloc
            ))

        return processed

    def _calculate_tvl_score(self, tvl: Decimal) -> float:
        """Calculate normalized TVL score.

        Uses logarithmic scaling for diminishing returns.

        Args:
            tvl: Total value locked

        Returns:
            Normalized score 0-1
        """
        min_tvl = self.risk_config.get("min_tvl", 100000)

        if float(tvl) < min_tvl:
            return 0.0

        # Logarithmic scaling: log(tvl/min_tvl) / log(target/min_tvl)
        # Target is 10x min_tvl for score of 1.0
        target = min_tvl * 10
        score = np.log(float(tvl) / min_tvl) / np.log(target / min_tvl)

        return min(1.0, max(0.0, score))

    def build_correlation_matrix(
        self,
        strategies: List[ProcessedStrategy],
        historical_data: Optional[Dict[str, pd.DataFrame]] = None
    ) -> np.ndarray:
        """Build correlation matrix for strategies.

        Args:
            strategies: List of processed strategies
            historical_data: Optional historical return data

        Returns:
            Correlation matrix as numpy array
        """
        n = len(strategies)

        if historical_data and len(historical_data) == n:
            # Calculate actual correlations from historical data
            returns_df = pd.DataFrame({
                s.strategy_id: historical_data[s.strategy_id]["returns"]
                for s in strategies
            })
            return returns_df.corr().values

        # Use assumed correlations based on strategy types
        # Strategies of same type are more correlated
        correlation = np.eye(n)

        for i, s1 in enumerate(strategies):
            for j, s2 in enumerate(strategies):
                if i != j:
                    if s1.name.split()[0] == s2.name.split()[0]:
                        # Same type = higher correlation
                        correlation[i, j] = 0.7
                    else:
                        # Different types = moderate correlation
                        correlation[i, j] = 0.3

        return correlation

    def prepare_optimization_input(
        self,
        metrics: List[StrategyMetrics],
        current_allocations: Optional[Dict[str, float]] = None,
        total_amount: Decimal = Decimal("1000"),
        historical_data: Optional[Dict[str, pd.DataFrame]] = None
    ) -> OptimizationInput:
        """Prepare all input data for optimization.

        Args:
            metrics: Raw strategy metrics
            current_allocations: Current allocation weights
            total_amount: Total amount to allocate
            historical_data: Optional historical data

        Returns:
            OptimizationInput ready for optimizer
        """
        # Process strategies
        processed = self.process_strategy_metrics(metrics, current_allocations)

        # Filter out strategies that don't meet requirements
        processed = self._filter_strategies(processed)

        # Build correlation matrix
        correlation = self.build_correlation_matrix(processed, historical_data)

        return OptimizationInput(
            strategies=processed,
            correlation_matrix=correlation,
            risk_free_rate=self.risk_config.get("risk_free_rate", 0.02),
            total_amount=total_amount
        )

    def _filter_strategies(
        self,
        strategies: List[ProcessedStrategy]
    ) -> List[ProcessedStrategy]:
        """Filter out strategies that don't meet risk requirements.

        Args:
            strategies: List of processed strategies

        Returns:
            Filtered list of strategies
        """
        max_volatility = self.risk_config.get("max_volatility", 0.30)
        min_sharpe = self.risk_config.get("min_sharpe_ratio", 0.5)

        filtered = []
        for s in strategies:
            # Check volatility
            if s.volatility > max_volatility:
                logger.info(
                    "Excluding strategy due to high volatility",
                    strategy=s.strategy_id,
                    volatility=s.volatility
                )
                continue

            # Check TVL (using tvl_score > 0 means it meets minimum)
            if s.tvl_score <= 0:
                logger.info(
                    "Excluding strategy due to low TVL",
                    strategy=s.strategy_id
                )
                continue

            # Check protocol age
            if s.age_score < 0.25:  # Less than 25% of target age
                logger.info(
                    "Excluding strategy due to protocol age",
                    strategy=s.strategy_id
                )
                continue

            filtered.append(s)

        return filtered

    def calculate_portfolio_metrics(
        self,
        strategies: List[ProcessedStrategy],
        weights: np.ndarray,
        correlation: np.ndarray
    ) -> Dict[str, float]:
        """Calculate portfolio metrics for given weights.

        Args:
            strategies: List of processed strategies
            weights: Portfolio weights
            correlation: Correlation matrix

        Returns:
            Dictionary of portfolio metrics
        """
        returns = np.array([s.expected_return for s in strategies])
        volatilities = np.array([s.volatility for s in strategies])

        # Expected portfolio return
        portfolio_return = np.dot(weights, returns)

        # Portfolio volatility (considering correlations)
        # Covariance matrix from correlation and individual volatilities
        cov_matrix = np.outer(volatilities, volatilities) * correlation
        portfolio_variance = np.dot(weights, np.dot(cov_matrix, weights))
        portfolio_volatility = np.sqrt(portfolio_variance)

        # Sharpe ratio
        risk_free_rate = self.risk_config.get("risk_free_rate", 0.02)
        sharpe_ratio = (portfolio_return - risk_free_rate) / portfolio_volatility if portfolio_volatility > 0 else 0

        # Weighted risk score
        risk_scores = np.array([s.risk_score for s in strategies])
        weighted_risk = np.dot(weights, risk_scores)

        return {
            "expected_return": float(portfolio_return),
            "volatility": float(portfolio_volatility),
            "sharpe_ratio": float(sharpe_ratio),
            "weighted_risk_score": float(weighted_risk),
            "diversification_ratio": float(np.sum(weights * volatilities) / portfolio_volatility) if portfolio_volatility > 0 else 1.0
        }

    def generate_historical_returns(
        self,
        strategies: List[ProcessedStrategy],
        days: int = 30
    ) -> Dict[str, pd.DataFrame]:
        """Generate synthetic historical returns for strategies.

        Args:
            strategies: List of processed strategies
            days: Number of days to generate

        Returns:
            Dictionary of DataFrames with historical returns
        """
        np.random.seed(42)  # For reproducibility

        historical = {}
        dates = pd.date_range(
            end=datetime.utcnow(),
            periods=days,
            freq='D'
        )

        for s in strategies:
            # Generate daily returns based on expected return and volatility
            daily_return = s.expected_return / 365
            daily_vol = s.volatility / np.sqrt(365)

            returns = np.random.normal(daily_return, daily_vol, days)

            historical[s.strategy_id] = pd.DataFrame({
                "date": dates,
                "returns": returns,
                "cumulative": np.cumprod(1 + returns)
            })

        return historical

    def normalize_allocations(
        self,
        allocations: Dict[str, float]
    ) -> Dict[str, float]:
        """Normalize allocations to sum to 1.

        Args:
            allocations: Raw allocation weights

        Returns:
            Normalized allocations
        """
        total = sum(allocations.values())
        if total == 0:
            return allocations

        return {k: v / total for k, v in allocations.items()}

    def calculate_rebalance_trades(
        self,
        current: Dict[str, float],
        target: Dict[str, float],
        total_amount: Decimal
    ) -> List[Dict[str, Any]]:
        """Calculate trades needed to rebalance portfolio.

        Args:
            current: Current allocation weights
            target: Target allocation weights
            total_amount: Total portfolio value

        Returns:
            List of trade instructions
        """
        trades = []
        threshold = self.config.get("optimization", {}).get("min_rebalance_threshold", 0.05)

        all_strategies = set(current.keys()) | set(target.keys())

        for strategy_id in all_strategies:
            current_weight = current.get(strategy_id, 0)
            target_weight = target.get(strategy_id, 0)
            diff = target_weight - current_weight

            if abs(diff) > threshold:
                amount = abs(diff) * float(total_amount)
                trades.append({
                    "strategy_id": strategy_id,
                    "action": "increase" if diff > 0 else "decrease",
                    "weight_change": diff,
                    "amount": amount
                })

        # Sort: decreases first (to free up capital), then increases
        trades.sort(key=lambda x: (x["action"] == "increase", -abs(x["weight_change"])))

        return trades
