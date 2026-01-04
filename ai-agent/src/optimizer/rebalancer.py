"""Portfolio rebalancing and allocation optimization."""

from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple
from dataclasses import dataclass
import numpy as np
from scipy.optimize import minimize, LinearConstraint, Bounds
import structlog

from src.data.processor import ProcessedStrategy, OptimizationInput

logger = structlog.get_logger()


@dataclass
class AllocationResult:
    """Result of portfolio optimization."""
    strategy_allocations: Dict[str, float]
    expected_return: float
    expected_volatility: float
    sharpe_ratio: float
    optimization_method: str
    timestamp: str


@dataclass
class RebalanceRecommendation:
    """Recommendation for portfolio rebalancing."""
    current_allocations: Dict[str, float]
    target_allocations: Dict[str, float]
    trades: List[Dict[str, Any]]
    expected_improvement: Dict[str, float]
    should_rebalance: bool
    reason: str


class PortfolioRebalancer:
    """Optimizes portfolio allocation across yield strategies."""

    def __init__(self, config: Dict[str, Any]):
        """Initialize portfolio rebalancer.

        Args:
            config: Configuration dictionary
        """
        self.config = config
        self.optimization_config = config.get("optimization", {})

        # Default optimization parameters
        self.method = self.optimization_config.get("method", "max_sharpe")
        self.min_rebalance_threshold = self.optimization_config.get("min_rebalance_threshold", 0.05)
        self.max_slippage = self.optimization_config.get("max_slippage", 0.02)

    def optimize(
        self,
        optimization_input: OptimizationInput,
        method: Optional[str] = None
    ) -> AllocationResult:
        """Optimize portfolio allocation.

        Args:
            optimization_input: Input data for optimization
            method: Optimization method (overrides config)

        Returns:
            AllocationResult with optimal allocations
        """
        method = method or self.method
        strategies = optimization_input.strategies
        n = len(strategies)

        if n == 0:
            return AllocationResult(
                strategy_allocations={},
                expected_return=0,
                expected_volatility=0,
                sharpe_ratio=0,
                optimization_method=method,
                timestamp=datetime.utcnow().isoformat()
            )

        # Get returns, volatilities, and constraints
        returns = np.array([s.expected_return for s in strategies])
        volatilities = np.array([s.volatility for s in strategies])
        min_weights = np.array([s.min_allocation for s in strategies])
        max_weights = np.array([s.max_allocation for s in strategies])

        # Build covariance matrix
        correlation = optimization_input.correlation_matrix
        cov_matrix = np.outer(volatilities, volatilities) * correlation

        # Choose optimization method
        if method == "max_sharpe":
            weights = self._optimize_max_sharpe(
                returns, cov_matrix, min_weights, max_weights,
                optimization_input.risk_free_rate
            )
        elif method == "min_variance":
            weights = self._optimize_min_variance(
                cov_matrix, min_weights, max_weights
            )
        elif method == "risk_parity":
            weights = self._optimize_risk_parity(
                volatilities, correlation, min_weights, max_weights
            )
        elif method == "mean_variance":
            weights = self._optimize_mean_variance(
                returns, cov_matrix, min_weights, max_weights,
                target_return=np.mean(returns)
            )
        else:
            # Default to equal weight
            weights = np.ones(n) / n
            weights = np.clip(weights, min_weights, max_weights)
            weights = weights / weights.sum()

        # Calculate portfolio metrics
        portfolio_return = np.dot(weights, returns)
        portfolio_variance = np.dot(weights, np.dot(cov_matrix, weights))
        portfolio_volatility = np.sqrt(portfolio_variance)
        sharpe = (portfolio_return - optimization_input.risk_free_rate) / portfolio_volatility if portfolio_volatility > 0 else 0

        # Build allocation dictionary
        allocations = {
            strategies[i].strategy_id: float(weights[i])
            for i in range(n)
        }

        return AllocationResult(
            strategy_allocations=allocations,
            expected_return=float(portfolio_return),
            expected_volatility=float(portfolio_volatility),
            sharpe_ratio=float(sharpe),
            optimization_method=method,
            timestamp=datetime.utcnow().isoformat()
        )

    def _optimize_max_sharpe(
        self,
        returns: np.ndarray,
        cov_matrix: np.ndarray,
        min_weights: np.ndarray,
        max_weights: np.ndarray,
        risk_free_rate: float
    ) -> np.ndarray:
        """Optimize for maximum Sharpe ratio.

        Args:
            returns: Expected returns
            cov_matrix: Covariance matrix
            min_weights: Minimum weights
            max_weights: Maximum weights
            risk_free_rate: Risk-free rate

        Returns:
            Optimal weights
        """
        n = len(returns)

        def neg_sharpe(weights):
            portfolio_return = np.dot(weights, returns)
            portfolio_vol = np.sqrt(np.dot(weights, np.dot(cov_matrix, weights)))
            if portfolio_vol == 0:
                return 0
            return -(portfolio_return - risk_free_rate) / portfolio_vol

        # Constraints: weights sum to 1
        constraints = [
            {"type": "eq", "fun": lambda w: np.sum(w) - 1}
        ]

        # Bounds
        bounds = Bounds(min_weights, max_weights)

        # Initial guess: equal weights within bounds
        x0 = np.ones(n) / n
        x0 = np.clip(x0, min_weights, max_weights)
        x0 = x0 / x0.sum()

        result = minimize(
            neg_sharpe,
            x0,
            method="SLSQP",
            bounds=bounds,
            constraints=constraints,
            options={"maxiter": 1000}
        )

        if result.success:
            return result.x
        else:
            logger.warning("Max Sharpe optimization failed, using equal weights")
            return x0

    def _optimize_min_variance(
        self,
        cov_matrix: np.ndarray,
        min_weights: np.ndarray,
        max_weights: np.ndarray
    ) -> np.ndarray:
        """Optimize for minimum variance.

        Args:
            cov_matrix: Covariance matrix
            min_weights: Minimum weights
            max_weights: Maximum weights

        Returns:
            Optimal weights
        """
        n = len(min_weights)

        def portfolio_variance(weights):
            return np.dot(weights, np.dot(cov_matrix, weights))

        constraints = [
            {"type": "eq", "fun": lambda w: np.sum(w) - 1}
        ]

        bounds = Bounds(min_weights, max_weights)

        x0 = np.ones(n) / n
        x0 = np.clip(x0, min_weights, max_weights)
        x0 = x0 / x0.sum()

        result = minimize(
            portfolio_variance,
            x0,
            method="SLSQP",
            bounds=bounds,
            constraints=constraints
        )

        if result.success:
            return result.x
        else:
            logger.warning("Min variance optimization failed, using equal weights")
            return x0

    def _optimize_risk_parity(
        self,
        volatilities: np.ndarray,
        correlation: np.ndarray,
        min_weights: np.ndarray,
        max_weights: np.ndarray
    ) -> np.ndarray:
        """Optimize for risk parity (equal risk contribution).

        Args:
            volatilities: Individual volatilities
            correlation: Correlation matrix
            min_weights: Minimum weights
            max_weights: Maximum weights

        Returns:
            Optimal weights
        """
        n = len(volatilities)
        cov_matrix = np.outer(volatilities, volatilities) * correlation

        def risk_parity_objective(weights):
            # Calculate marginal risk contributions
            portfolio_vol = np.sqrt(np.dot(weights, np.dot(cov_matrix, weights)))
            if portfolio_vol == 0:
                return 0

            marginal_contrib = np.dot(cov_matrix, weights) / portfolio_vol
            risk_contrib = weights * marginal_contrib

            # Target: equal risk contribution
            target_risk = portfolio_vol / n
            return np.sum((risk_contrib - target_risk) ** 2)

        constraints = [
            {"type": "eq", "fun": lambda w: np.sum(w) - 1}
        ]

        bounds = Bounds(min_weights, max_weights)

        # Initial guess: inverse volatility weighting
        x0 = 1 / volatilities
        x0 = np.clip(x0, min_weights, max_weights)
        x0 = x0 / x0.sum()

        result = minimize(
            risk_parity_objective,
            x0,
            method="SLSQP",
            bounds=bounds,
            constraints=constraints
        )

        if result.success:
            return result.x
        else:
            logger.warning("Risk parity optimization failed, using inverse vol")
            return x0

    def _optimize_mean_variance(
        self,
        returns: np.ndarray,
        cov_matrix: np.ndarray,
        min_weights: np.ndarray,
        max_weights: np.ndarray,
        target_return: float
    ) -> np.ndarray:
        """Mean-variance optimization with target return.

        Args:
            returns: Expected returns
            cov_matrix: Covariance matrix
            min_weights: Minimum weights
            max_weights: Maximum weights
            target_return: Target portfolio return

        Returns:
            Optimal weights
        """
        n = len(returns)

        def portfolio_variance(weights):
            return np.dot(weights, np.dot(cov_matrix, weights))

        constraints = [
            {"type": "eq", "fun": lambda w: np.sum(w) - 1},
            {"type": "eq", "fun": lambda w: np.dot(w, returns) - target_return}
        ]

        bounds = Bounds(min_weights, max_weights)

        x0 = np.ones(n) / n
        x0 = np.clip(x0, min_weights, max_weights)
        x0 = x0 / x0.sum()

        result = minimize(
            portfolio_variance,
            x0,
            method="SLSQP",
            bounds=bounds,
            constraints=constraints
        )

        if result.success:
            return result.x
        else:
            # Fall back to max Sharpe if target return is not achievable
            logger.warning("Mean-variance optimization failed, falling back to max Sharpe")
            return self._optimize_max_sharpe(
                returns, cov_matrix, min_weights, max_weights, 0.02
            )

    def generate_efficient_frontier(
        self,
        optimization_input: OptimizationInput,
        num_points: int = 20
    ) -> List[Dict[str, float]]:
        """Generate efficient frontier points.

        Args:
            optimization_input: Input data for optimization
            num_points: Number of points on frontier

        Returns:
            List of frontier points with return, volatility, sharpe
        """
        strategies = optimization_input.strategies
        n = len(strategies)

        if n == 0:
            return []

        returns = np.array([s.expected_return for s in strategies])
        volatilities = np.array([s.volatility for s in strategies])
        min_weights = np.array([s.min_allocation for s in strategies])
        max_weights = np.array([s.max_allocation for s in strategies])

        correlation = optimization_input.correlation_matrix
        cov_matrix = np.outer(volatilities, volatilities) * correlation

        # Generate target returns
        min_return = np.min(returns)
        max_return = np.max(returns)
        target_returns = np.linspace(min_return, max_return, num_points)

        frontier = []
        for target in target_returns:
            try:
                weights = self._optimize_mean_variance(
                    returns, cov_matrix, min_weights, max_weights, target
                )

                portfolio_return = np.dot(weights, returns)
                portfolio_vol = np.sqrt(np.dot(weights, np.dot(cov_matrix, weights)))
                sharpe = (portfolio_return - optimization_input.risk_free_rate) / portfolio_vol if portfolio_vol > 0 else 0

                frontier.append({
                    "return": float(portfolio_return),
                    "volatility": float(portfolio_vol),
                    "sharpe_ratio": float(sharpe),
                    "weights": {
                        strategies[i].strategy_id: float(weights[i])
                        for i in range(n)
                    }
                })
            except Exception as e:
                logger.debug("Failed to compute frontier point", target=target, error=str(e))
                continue

        return frontier

    def recommend_rebalance(
        self,
        current_allocations: Dict[str, float],
        optimization_input: OptimizationInput,
        total_value: float
    ) -> RebalanceRecommendation:
        """Generate rebalancing recommendation.

        Args:
            current_allocations: Current allocation weights
            optimization_input: Input for optimization
            total_value: Total portfolio value

        Returns:
            RebalanceRecommendation
        """
        # Get optimal allocation
        optimal = self.optimize(optimization_input)
        target_allocations = optimal.strategy_allocations

        # Calculate current portfolio metrics
        strategies = optimization_input.strategies
        n = len(strategies)

        if n == 0:
            return RebalanceRecommendation(
                current_allocations=current_allocations,
                target_allocations={},
                trades=[],
                expected_improvement={},
                should_rebalance=False,
                reason="No eligible strategies"
            )

        returns = np.array([s.expected_return for s in strategies])
        volatilities = np.array([s.volatility for s in strategies])
        correlation = optimization_input.correlation_matrix
        cov_matrix = np.outer(volatilities, volatilities) * correlation

        # Current weights
        current_weights = np.array([
            current_allocations.get(s.strategy_id, 0)
            for s in strategies
        ])

        # Calculate current metrics
        if current_weights.sum() > 0:
            current_weights = current_weights / current_weights.sum()
            current_return = np.dot(current_weights, returns)
            current_vol = np.sqrt(np.dot(current_weights, np.dot(cov_matrix, current_weights)))
            current_sharpe = (current_return - optimization_input.risk_free_rate) / current_vol if current_vol > 0 else 0
        else:
            current_return = 0
            current_vol = 0
            current_sharpe = 0

        # Calculate improvement
        improvement = {
            "return_improvement": optimal.expected_return - current_return,
            "volatility_change": optimal.expected_volatility - current_vol,
            "sharpe_improvement": optimal.sharpe_ratio - current_sharpe
        }

        # Calculate required trades
        trades = []
        for strategy in strategies:
            sid = strategy.strategy_id
            current = current_allocations.get(sid, 0)
            target = target_allocations.get(sid, 0)
            diff = target - current

            if abs(diff) > self.min_rebalance_threshold:
                trades.append({
                    "strategy_id": sid,
                    "action": "increase" if diff > 0 else "decrease",
                    "current_weight": current,
                    "target_weight": target,
                    "weight_change": diff,
                    "amount_usd": abs(diff) * total_value
                })

        # Sort trades: decreases first, then increases
        trades.sort(key=lambda x: (x["action"] == "increase", -abs(x["weight_change"])))

        # Determine if rebalancing is worthwhile
        should_rebalance = (
            len(trades) > 0 and
            (improvement["sharpe_improvement"] > 0.05 or
             improvement["return_improvement"] > 0.01)
        )

        reason = self._generate_rebalance_reason(improvement, trades, should_rebalance)

        return RebalanceRecommendation(
            current_allocations=current_allocations,
            target_allocations=target_allocations,
            trades=trades,
            expected_improvement=improvement,
            should_rebalance=should_rebalance,
            reason=reason
        )

    def _generate_rebalance_reason(
        self,
        improvement: Dict[str, float],
        trades: List[Dict[str, Any]],
        should_rebalance: bool
    ) -> str:
        """Generate human-readable rebalancing reason.

        Args:
            improvement: Expected improvements
            trades: Required trades
            should_rebalance: Whether to rebalance

        Returns:
            Reason string
        """
        if not should_rebalance:
            if len(trades) == 0:
                return "Portfolio is already optimally allocated"
            else:
                return "Potential improvement is too small to justify rebalancing costs"

        reasons = []

        if improvement["sharpe_improvement"] > 0.1:
            reasons.append(f"Significant Sharpe ratio improvement (+{improvement['sharpe_improvement']:.2f})")

        if improvement["return_improvement"] > 0.02:
            reasons.append(f"Expected return increase (+{improvement['return_improvement']:.1%})")

        if improvement["volatility_change"] < -0.02:
            reasons.append(f"Risk reduction ({improvement['volatility_change']:.1%} volatility)")

        if len(reasons) == 0:
            reasons.append("Minor portfolio optimization opportunity")

        return "; ".join(reasons)
