"""Main AI yield optimizer agent."""

import asyncio
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional
from dataclasses import dataclass, asdict
from decimal import Decimal
import yaml
import structlog

from src.casper.client import CasperClient
from src.casper.contract import ContractClient
from src.data.fetcher import DataFetcher, StrategyMetrics
from src.data.processor import DataProcessor, OptimizationInput
from .predictor import YieldPredictor, YieldPrediction
from .risk_analyzer import RiskAnalyzer, PortfolioRiskAssessment
from .rebalancer import PortfolioRebalancer, AllocationResult, RebalanceRecommendation

logger = structlog.get_logger()


@dataclass
class AgentState:
    """Current state of the optimizer agent."""
    is_running: bool
    last_optimization: Optional[str]
    last_data_fetch: Optional[str]
    current_allocations: Dict[str, float]
    optimization_count: int
    error_count: int


@dataclass
class OptimizationResult:
    """Complete optimization result."""
    timestamp: str
    allocation: AllocationResult
    predictions: List[YieldPrediction]
    risk_assessment: PortfolioRiskAssessment
    rebalance_recommendation: Optional[RebalanceRecommendation]
    strategy_metrics: List[Dict[str, Any]]


class YieldOptimizerAgent:
    """AI agent for optimizing yield strategies on Casper Network."""

    def __init__(self, config_path: str = "config.yaml"):
        """Initialize the yield optimizer agent.

        Args:
            config_path: Path to configuration file
        """
        self.config = self._load_config(config_path)

        # Initialize components
        self.casper_client: Optional[CasperClient] = None
        self.contract_client: Optional[ContractClient] = None
        self.data_fetcher: Optional[DataFetcher] = None
        self.data_processor: Optional[DataProcessor] = None
        self.predictor: Optional[YieldPredictor] = None
        self.risk_analyzer: Optional[RiskAnalyzer] = None
        self.rebalancer: Optional[PortfolioRebalancer] = None

        # Agent state
        self.state = AgentState(
            is_running=False,
            last_optimization=None,
            last_data_fetch=None,
            current_allocations={},
            optimization_count=0,
            error_count=0
        )

        # Cache
        self._cache: Dict[str, Any] = {}
        self._last_result: Optional[OptimizationResult] = None

    def _load_config(self, config_path: str) -> Dict[str, Any]:
        """Load configuration from YAML file.

        Args:
            config_path: Path to config file

        Returns:
            Configuration dictionary
        """
        try:
            with open(config_path, "r") as f:
                return yaml.safe_load(f)
        except Exception as e:
            logger.warning("Failed to load config, using defaults", error=str(e))
            return self._default_config()

    def _default_config(self) -> Dict[str, Any]:
        """Get default configuration.

        Returns:
            Default configuration dictionary
        """
        return {
            "casper": {
                "rpc": {"testnet": "https://rpc.testnet.casperlabs.io/rpc"},
                "network": "testnet",
                "chain_name": "casper-test"
            },
            "contracts": {
                "vault_factory": "hash-0000000000000000000000000000000000000000000000000000000000000001",
                "strategy_registry": "hash-0000000000000000000000000000000000000000000000000000000000000002",
                "oracle": "hash-0000000000000000000000000000000000000000000000000000000000000003"
            },
            "strategies": [
                {"id": "staking", "name": "Native Staking", "min_allocation": 0.1, "max_allocation": 0.5},
                {"id": "lending", "name": "Lending Protocol", "min_allocation": 0.0, "max_allocation": 0.4},
                {"id": "lp", "name": "Liquidity Provision", "min_allocation": 0.0, "max_allocation": 0.3}
            ],
            "risk": {
                "max_volatility": 0.30,
                "min_sharpe_ratio": 0.5,
                "risk_free_rate": 0.02,
                "max_drawdown": 0.15,
                "min_tvl": 100000,
                "min_protocol_age": 30
            },
            "optimization": {
                "rebalance_interval": 24,
                "min_rebalance_threshold": 0.05,
                "max_slippage": 0.02,
                "lookback_days": 30,
                "method": "max_sharpe"
            }
        }

    async def initialize(self):
        """Initialize all components asynchronously."""
        logger.info("Initializing yield optimizer agent")

        # Get RPC URL based on network
        network = self.config["casper"]["network"]
        rpc_url = self.config["casper"]["rpc"].get(network)
        chain_name = self.config["casper"]["chain_name"]

        # Initialize Casper client
        self.casper_client = CasperClient(rpc_url, chain_name)

        # Initialize contract client
        contracts = self.config["contracts"]
        self.contract_client = ContractClient(
            self.casper_client,
            contracts["vault_factory"],
            contracts["strategy_registry"],
            contracts["oracle"]
        )

        # Initialize data components
        self.data_fetcher = DataFetcher(
            self.casper_client,
            self.contract_client,
            self.config
        )
        self.data_processor = DataProcessor(self.config)

        # Initialize optimization components
        self.predictor = YieldPredictor(self.config)
        self.risk_analyzer = RiskAnalyzer(self.config)
        self.rebalancer = PortfolioRebalancer(self.config)

        self.state.is_running = True
        logger.info("Agent initialization complete")

    async def shutdown(self):
        """Shutdown the agent and cleanup resources."""
        logger.info("Shutting down yield optimizer agent")
        self.state.is_running = False

        if self.casper_client:
            await self.casper_client.__aexit__(None, None, None)

        if self.data_fetcher:
            await self.data_fetcher.__aexit__(None, None, None)

    async def fetch_data(self) -> List[StrategyMetrics]:
        """Fetch latest data from on-chain and external sources.

        Returns:
            List of strategy metrics
        """
        logger.info("Fetching strategy data")

        async with self.data_fetcher:
            metrics = await self.data_fetcher.get_all_strategy_metrics()

        self.state.last_data_fetch = datetime.utcnow().isoformat()
        return metrics

    async def run_optimization(
        self,
        total_amount: Decimal = Decimal("10000"),
        risk_tolerance: str = "moderate",
        method: Optional[str] = None
    ) -> OptimizationResult:
        """Run a complete optimization cycle.

        Args:
            total_amount: Total amount to allocate
            risk_tolerance: Risk tolerance level
            method: Optimization method override

        Returns:
            OptimizationResult with complete analysis
        """
        logger.info(
            "Running optimization",
            amount=str(total_amount),
            risk_tolerance=risk_tolerance,
            method=method
        )

        try:
            # 1. Fetch latest data
            metrics = await self.fetch_data()

            # 2. Process data for optimization
            optimization_input = self.data_processor.prepare_optimization_input(
                metrics,
                self.state.current_allocations,
                total_amount
            )

            # 3. Generate yield predictions
            predictions = await self._generate_predictions(metrics)

            # 4. Run portfolio optimization
            allocation = self.rebalancer.optimize(
                optimization_input,
                method=method or self.config["optimization"]["method"]
            )

            # 5. Assess portfolio risk
            import numpy as np
            weights = np.array([
                allocation.strategy_allocations.get(s.strategy_id, 0)
                for s in optimization_input.strategies
            ])

            risk_assessment = self.risk_analyzer.assess_portfolio_risk(
                optimization_input.strategies,
                weights,
                optimization_input.correlation_matrix
            )

            # 6. Generate rebalance recommendation if we have current allocations
            rebalance_rec = None
            if self.state.current_allocations:
                rebalance_rec = self.rebalancer.recommend_rebalance(
                    self.state.current_allocations,
                    optimization_input,
                    float(total_amount)
                )

            # 7. Build result
            result = OptimizationResult(
                timestamp=datetime.utcnow().isoformat(),
                allocation=allocation,
                predictions=predictions,
                risk_assessment=risk_assessment,
                rebalance_recommendation=rebalance_rec,
                strategy_metrics=[
                    {
                        "id": m.strategy_id,
                        "name": m.name,
                        "type": m.strategy_type,
                        "apy": float(m.current_apy),
                        "tvl": float(m.tvl),
                        "risk_score": m.risk_score,
                        "sharpe_ratio": float(m.sharpe_ratio)
                    }
                    for m in metrics
                ]
            )

            # Update state
            self.state.last_optimization = result.timestamp
            self.state.optimization_count += 1
            self._last_result = result

            logger.info(
                "Optimization complete",
                expected_return=f"{allocation.expected_return:.2%}",
                volatility=f"{allocation.expected_volatility:.2%}",
                sharpe=f"{allocation.sharpe_ratio:.2f}"
            )

            return result

        except Exception as e:
            self.state.error_count += 1
            logger.error("Optimization failed", error=str(e))
            raise

    async def _generate_predictions(
        self,
        metrics: List[StrategyMetrics]
    ) -> List[YieldPrediction]:
        """Generate yield predictions for all strategies.

        Args:
            metrics: Strategy metrics

        Returns:
            List of yield predictions
        """
        predictions = []

        for m in metrics:
            # Generate synthetic history for training (in production, use real data)
            history = self.predictor.generate_synthetic_history(
                base_apy=float(m.current_apy),
                volatility=float(m.volatility),
                days=60
            )

            # Train predictor
            self.predictor.train(m.strategy_id, history)

            # Generate prediction
            prediction = self.predictor.predict(
                m.strategy_id,
                history.tail(30)
            )
            predictions.append(prediction)

        return predictions

    async def get_recommendation(
        self,
        user_amount: Decimal,
        risk_tolerance: str = "moderate"
    ) -> Dict[str, Any]:
        """Get personalized recommendation for a user.

        Args:
            user_amount: Amount user wants to invest
            risk_tolerance: User's risk tolerance

        Returns:
            Recommendation dictionary
        """
        # Run optimization
        result = await self.run_optimization(
            total_amount=user_amount,
            risk_tolerance=risk_tolerance
        )

        # Format for user consumption
        recommendation = {
            "timestamp": result.timestamp,
            "investment_amount": float(user_amount),
            "risk_tolerance": risk_tolerance,
            "recommended_allocation": {
                strategy_id: {
                    "weight": weight,
                    "amount": float(user_amount) * weight
                }
                for strategy_id, weight in result.allocation.strategy_allocations.items()
            },
            "expected_metrics": {
                "annual_return": f"{result.allocation.expected_return:.2%}",
                "annual_volatility": f"{result.allocation.expected_volatility:.2%}",
                "sharpe_ratio": f"{result.allocation.sharpe_ratio:.2f}"
            },
            "risk_assessment": {
                "overall_risk": result.risk_assessment.risk_level,
                "risk_score": result.risk_assessment.overall_risk_score,
                "warnings": result.risk_assessment.warnings,
                "recommendations": result.risk_assessment.recommendations
            },
            "yield_predictions": [
                {
                    "strategy": p.strategy_id,
                    "current_apy": f"{p.current_apy:.2%}",
                    "predicted_7d": f"{p.predicted_apy_7d:.2%}",
                    "predicted_30d": f"{p.predicted_apy_30d:.2%}",
                    "trend": p.trend,
                    "confidence": f"{p.confidence:.0%}"
                }
                for p in result.predictions
            ],
            "strategies": result.strategy_metrics
        }

        return recommendation

    async def update_allocations(self, new_allocations: Dict[str, float]):
        """Update current allocations (after user executes trades).

        Args:
            new_allocations: New allocation weights
        """
        self.state.current_allocations = new_allocations
        logger.info("Updated current allocations", allocations=new_allocations)

    def get_state(self) -> Dict[str, Any]:
        """Get current agent state.

        Returns:
            Agent state dictionary
        """
        return asdict(self.state)

    def get_last_result(self) -> Optional[Dict[str, Any]]:
        """Get the last optimization result.

        Returns:
            Last optimization result as dictionary
        """
        if not self._last_result:
            return None

        return {
            "timestamp": self._last_result.timestamp,
            "allocation": {
                "strategies": self._last_result.allocation.strategy_allocations,
                "expected_return": self._last_result.allocation.expected_return,
                "expected_volatility": self._last_result.allocation.expected_volatility,
                "sharpe_ratio": self._last_result.allocation.sharpe_ratio,
                "method": self._last_result.allocation.optimization_method
            },
            "risk": {
                "level": self._last_result.risk_assessment.risk_level,
                "score": self._last_result.risk_assessment.overall_risk_score,
                "var_95": self._last_result.risk_assessment.var_95,
                "max_drawdown": self._last_result.risk_assessment.max_drawdown
            },
            "strategies": self._last_result.strategy_metrics
        }

    async def run_continuous(self, interval_hours: int = 24):
        """Run continuous optimization loop.

        Args:
            interval_hours: Hours between optimizations
        """
        logger.info("Starting continuous optimization", interval=interval_hours)

        while self.state.is_running:
            try:
                await self.run_optimization()
                logger.info(f"Next optimization in {interval_hours} hours")
                await asyncio.sleep(interval_hours * 3600)

            except asyncio.CancelledError:
                logger.info("Continuous optimization cancelled")
                break

            except Exception as e:
                logger.error("Error in optimization loop", error=str(e))
                # Wait a bit before retrying
                await asyncio.sleep(300)  # 5 minutes
