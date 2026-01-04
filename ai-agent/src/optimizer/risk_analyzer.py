"""Risk analysis module for yield strategies."""

from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple
from dataclasses import dataclass
from decimal import Decimal
import numpy as np
import structlog

from src.data.processor import ProcessedStrategy

logger = structlog.get_logger()


@dataclass
class RiskAssessment:
    """Risk assessment result for a strategy."""
    strategy_id: str
    overall_risk_score: float  # 0-100
    risk_level: str  # "low", "medium", "high", "very_high"
    components: Dict[str, float]  # Individual risk components
    warnings: List[str]
    recommendations: List[str]


@dataclass
class PortfolioRiskAssessment:
    """Risk assessment for entire portfolio."""
    overall_risk_score: float
    risk_level: str
    var_95: float  # Value at Risk 95%
    expected_shortfall: float
    max_drawdown: float
    concentration_risk: float
    correlation_risk: float
    strategy_risks: List[RiskAssessment]
    warnings: List[str]
    recommendations: List[str]


class RiskAnalyzer:
    """Analyzes risk for strategies and portfolios."""

    def __init__(self, config: Dict[str, Any]):
        """Initialize risk analyzer.

        Args:
            config: Configuration dictionary
        """
        self.config = config
        self.risk_config = config.get("risk", {})

        # Risk thresholds
        self.max_volatility = self.risk_config.get("max_volatility", 0.30)
        self.max_drawdown = self.risk_config.get("max_drawdown", 0.15)
        self.min_tvl = self.risk_config.get("min_tvl", 100000)
        self.min_protocol_age = self.risk_config.get("min_protocol_age", 30)

    def assess_strategy_risk(
        self,
        strategy: ProcessedStrategy,
        historical_returns: Optional[np.ndarray] = None
    ) -> RiskAssessment:
        """Assess risk for a single strategy.

        Args:
            strategy: Processed strategy data
            historical_returns: Optional historical return data

        Returns:
            RiskAssessment result
        """
        components = {}
        warnings = []
        recommendations = []

        # 1. Volatility risk (0-25 points)
        vol_risk = self._calculate_volatility_risk(strategy.volatility)
        components["volatility_risk"] = vol_risk

        if strategy.volatility > self.max_volatility:
            warnings.append(f"High volatility ({strategy.volatility:.1%}) exceeds threshold")

        # 2. Smart contract risk (0-25 points)
        sc_risk = self._calculate_smart_contract_risk(strategy)
        components["smart_contract_risk"] = sc_risk

        if strategy.age_score < 0.5:
            warnings.append("Protocol is relatively new")
            recommendations.append("Consider reducing allocation until protocol matures")

        # 3. Liquidity risk (0-25 points)
        liq_risk = self._calculate_liquidity_risk(strategy.tvl_score)
        components["liquidity_risk"] = liq_risk

        if strategy.tvl_score < 0.5:
            warnings.append("Lower TVL may indicate liquidity concerns")

        # 4. Strategy-specific risk (0-25 points)
        specific_risk = self._calculate_strategy_specific_risk(strategy)
        components["strategy_specific_risk"] = specific_risk

        # Calculate overall risk score
        overall_risk = sum(components.values())

        # Determine risk level
        risk_level = self._get_risk_level(overall_risk)

        # Add general recommendations based on risk level
        if risk_level in ["high", "very_high"]:
            recommendations.append("Consider diversifying across multiple strategies")
            recommendations.append("Set stop-loss or maximum allocation limits")

        return RiskAssessment(
            strategy_id=strategy.strategy_id,
            overall_risk_score=overall_risk,
            risk_level=risk_level,
            components=components,
            warnings=warnings,
            recommendations=recommendations
        )

    def _calculate_volatility_risk(self, volatility: float) -> float:
        """Calculate risk score from volatility.

        Args:
            volatility: Annualized volatility

        Returns:
            Risk score 0-25
        """
        # Linear scaling: 0% vol = 0 risk, 50% vol = 25 risk
        return min(25, volatility * 50)

    def _calculate_smart_contract_risk(self, strategy: ProcessedStrategy) -> float:
        """Calculate smart contract risk based on protocol age and audits.

        Args:
            strategy: Processed strategy

        Returns:
            Risk score 0-25
        """
        # Age-based risk (newer = higher risk)
        age_risk = 25 * (1 - strategy.age_score)

        # Adjust based on strategy type (some are inherently safer)
        type_multipliers = {
            "staking": 0.6,  # Native staking is safer
            "lending": 0.8,
            "liquidity": 1.0,
        }

        # Extract strategy type from name
        strategy_type = strategy.name.lower().split()[0] if strategy.name else "unknown"
        multiplier = type_multipliers.get(strategy_type, 1.0)

        return age_risk * multiplier

    def _calculate_liquidity_risk(self, tvl_score: float) -> float:
        """Calculate liquidity risk based on TVL.

        Args:
            tvl_score: Normalized TVL score 0-1

        Returns:
            Risk score 0-25
        """
        # Lower TVL = higher risk
        return 25 * (1 - tvl_score)

    def _calculate_strategy_specific_risk(self, strategy: ProcessedStrategy) -> float:
        """Calculate strategy-specific risk factors.

        Args:
            strategy: Processed strategy

        Returns:
            Risk score 0-25
        """
        base_risk = strategy.risk_score * 25  # risk_score is 0-1

        # Adjust for extreme APY (if APY is too high, it might be unsustainable)
        if strategy.expected_return > 0.50:  # >50% APY
            base_risk += 5
        elif strategy.expected_return > 0.30:  # >30% APY
            base_risk += 2

        return min(25, base_risk)

    def _get_risk_level(self, risk_score: float) -> str:
        """Convert risk score to risk level.

        Args:
            risk_score: Overall risk score 0-100

        Returns:
            Risk level string
        """
        if risk_score < 25:
            return "low"
        elif risk_score < 50:
            return "medium"
        elif risk_score < 75:
            return "high"
        else:
            return "very_high"

    def assess_portfolio_risk(
        self,
        strategies: List[ProcessedStrategy],
        weights: np.ndarray,
        correlation_matrix: np.ndarray,
        historical_returns: Optional[Dict[str, np.ndarray]] = None
    ) -> PortfolioRiskAssessment:
        """Assess risk for an entire portfolio.

        Args:
            strategies: List of processed strategies
            weights: Portfolio weights
            correlation_matrix: Correlation matrix between strategies
            historical_returns: Optional historical returns per strategy

        Returns:
            PortfolioRiskAssessment result
        """
        warnings = []
        recommendations = []

        # Assess individual strategy risks
        strategy_risks = [
            self.assess_strategy_risk(
                s,
                historical_returns.get(s.strategy_id) if historical_returns else None
            )
            for s in strategies
        ]

        # 1. Calculate weighted portfolio volatility
        volatilities = np.array([s.volatility for s in strategies])
        cov_matrix = np.outer(volatilities, volatilities) * correlation_matrix
        portfolio_variance = np.dot(weights, np.dot(cov_matrix, weights))
        portfolio_volatility = np.sqrt(portfolio_variance)

        # 2. Calculate Value at Risk (95%)
        # Assuming normal distribution
        var_95 = portfolio_volatility * 1.645  # 95% confidence

        # 3. Calculate Expected Shortfall (CVaR)
        expected_shortfall = portfolio_volatility * 2.063  # Assuming normal dist

        # 4. Calculate concentration risk (Herfindahl index)
        concentration_risk = np.sum(weights ** 2)

        if concentration_risk > 0.5:
            warnings.append("High concentration risk - portfolio is not well diversified")
            recommendations.append("Consider spreading allocation across more strategies")

        # 5. Calculate correlation risk
        # Average pairwise correlation weighted by position sizes
        n = len(strategies)
        if n > 1:
            correlation_risk = 0
            for i in range(n):
                for j in range(i + 1, n):
                    correlation_risk += weights[i] * weights[j] * correlation_matrix[i, j]
            correlation_risk = correlation_risk / (1 - concentration_risk) if concentration_risk < 1 else 0
        else:
            correlation_risk = 0

        if correlation_risk > 0.6:
            warnings.append("High correlation between strategies reduces diversification benefits")

        # 6. Estimate max drawdown
        max_drawdown = self._estimate_max_drawdown(
            portfolio_volatility,
            historical_returns
        )

        if max_drawdown > self.max_drawdown:
            warnings.append(f"Estimated max drawdown ({max_drawdown:.1%}) exceeds threshold")

        # Calculate overall portfolio risk score
        weighted_strategy_risk = sum(
            w * sr.overall_risk_score
            for w, sr in zip(weights, strategy_risks)
        )

        concentration_penalty = concentration_risk * 20
        correlation_penalty = correlation_risk * 10

        overall_risk = min(100, weighted_strategy_risk + concentration_penalty + correlation_penalty)
        risk_level = self._get_risk_level(overall_risk)

        # Add overall recommendations
        if risk_level == "low":
            recommendations.append("Portfolio risk is well managed")
        elif risk_level == "medium":
            recommendations.append("Consider risk-reward balance is appropriate for your goals")
        else:
            recommendations.append("High risk portfolio - ensure this aligns with your risk tolerance")
            recommendations.append("Consider reducing exposure to highest-risk strategies")

        return PortfolioRiskAssessment(
            overall_risk_score=overall_risk,
            risk_level=risk_level,
            var_95=var_95,
            expected_shortfall=expected_shortfall,
            max_drawdown=max_drawdown,
            concentration_risk=concentration_risk,
            correlation_risk=correlation_risk,
            strategy_risks=strategy_risks,
            warnings=warnings,
            recommendations=recommendations
        )

    def _estimate_max_drawdown(
        self,
        volatility: float,
        historical_returns: Optional[Dict[str, np.ndarray]] = None
    ) -> float:
        """Estimate maximum drawdown.

        Args:
            volatility: Portfolio volatility
            historical_returns: Optional historical returns

        Returns:
            Estimated max drawdown
        """
        if historical_returns:
            # Calculate actual max drawdown from history
            all_returns = []
            for returns in historical_returns.values():
                all_returns.extend(returns)

            if len(all_returns) > 0:
                cumulative = np.cumprod(1 + np.array(all_returns))
                peak = np.maximum.accumulate(cumulative)
                drawdowns = (peak - cumulative) / peak
                return float(np.max(drawdowns))

        # Estimate based on volatility (rule of thumb)
        # Max drawdown is typically 2-3x annual volatility
        return min(0.5, volatility * 2.5)

    def calculate_risk_adjusted_return(
        self,
        expected_return: float,
        volatility: float,
        risk_free_rate: Optional[float] = None
    ) -> Dict[str, float]:
        """Calculate various risk-adjusted return metrics.

        Args:
            expected_return: Expected annual return
            volatility: Annual volatility
            risk_free_rate: Risk-free rate (uses config default if None)

        Returns:
            Dictionary of risk-adjusted metrics
        """
        if risk_free_rate is None:
            risk_free_rate = self.risk_config.get("risk_free_rate", 0.02)

        # Sharpe Ratio
        sharpe = (expected_return - risk_free_rate) / volatility if volatility > 0 else 0

        # Sortino Ratio (assuming downside deviation is ~0.7 of total volatility)
        downside_vol = volatility * 0.7
        sortino = (expected_return - risk_free_rate) / downside_vol if downside_vol > 0 else 0

        # Calmar Ratio (return / max drawdown)
        estimated_max_dd = self._estimate_max_drawdown(volatility)
        calmar = expected_return / estimated_max_dd if estimated_max_dd > 0 else 0

        return {
            "sharpe_ratio": sharpe,
            "sortino_ratio": sortino,
            "calmar_ratio": calmar,
            "return_per_risk": expected_return / volatility if volatility > 0 else 0
        }

    def get_risk_limits(
        self,
        risk_tolerance: str = "moderate"
    ) -> Dict[str, float]:
        """Get risk limits based on risk tolerance.

        Args:
            risk_tolerance: "conservative", "moderate", or "aggressive"

        Returns:
            Dictionary of risk limits
        """
        limits = {
            "conservative": {
                "max_volatility": 0.15,
                "max_single_allocation": 0.40,
                "max_risk_score": 40,
                "min_sharpe": 1.0,
                "max_drawdown": 0.10
            },
            "moderate": {
                "max_volatility": 0.25,
                "max_single_allocation": 0.50,
                "max_risk_score": 60,
                "min_sharpe": 0.5,
                "max_drawdown": 0.20
            },
            "aggressive": {
                "max_volatility": 0.40,
                "max_single_allocation": 0.70,
                "max_risk_score": 80,
                "min_sharpe": 0.0,
                "max_drawdown": 0.35
            }
        }

        return limits.get(risk_tolerance, limits["moderate"])
