"""Data fetcher for on-chain and external data."""

import asyncio
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional
from dataclasses import dataclass
from decimal import Decimal
import httpx
import structlog

from src.casper.client import CasperClient
from src.casper.contract import ContractClient, StrategyInfo

logger = structlog.get_logger()


@dataclass
class MarketData:
    """Market data for a token."""
    symbol: str
    price_usd: Decimal
    price_change_24h: Decimal
    volume_24h: Decimal
    market_cap: Decimal
    timestamp: datetime


@dataclass
class StrategyMetrics:
    """Comprehensive strategy metrics."""
    strategy_id: str
    name: str
    strategy_type: str
    current_apy: Decimal
    avg_apy_7d: Decimal
    avg_apy_30d: Decimal
    tvl: Decimal
    tvl_change_24h: Decimal
    risk_score: int
    volatility: Decimal
    sharpe_ratio: Decimal
    max_drawdown: Decimal
    protocol_age_days: int


class DataFetcher:
    """Fetches and aggregates data from multiple sources."""

    def __init__(
        self,
        casper_client: CasperClient,
        contract_client: ContractClient,
        config: Dict[str, Any]
    ):
        """Initialize data fetcher.

        Args:
            casper_client: Casper RPC client
            contract_client: Contract interaction client
            config: Configuration dictionary
        """
        self.casper_client = casper_client
        self.contract_client = contract_client
        self.config = config
        self._http_client: Optional[httpx.AsyncClient] = None
        self._cache: Dict[str, Any] = {}
        self._cache_timestamps: Dict[str, datetime] = {}

    async def __aenter__(self):
        """Async context manager entry."""
        self._http_client = httpx.AsyncClient(timeout=30.0)
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit."""
        if self._http_client:
            await self._http_client.aclose()

    def _is_cache_valid(self, key: str, duration_seconds: int = 300) -> bool:
        """Check if cached data is still valid.

        Args:
            key: Cache key
            duration_seconds: Cache duration in seconds

        Returns:
            True if cache is valid
        """
        if key not in self._cache_timestamps:
            return False
        age = datetime.utcnow() - self._cache_timestamps[key]
        return age.total_seconds() < duration_seconds

    async def get_market_data(self, symbol: str = "casper-network") -> MarketData:
        """Get market data from external sources.

        Args:
            symbol: CoinGecko symbol for the token

        Returns:
            MarketData object
        """
        cache_key = f"market_{symbol}"
        if self._is_cache_valid(cache_key):
            return self._cache[cache_key]

        try:
            if not self._http_client:
                self._http_client = httpx.AsyncClient(timeout=30.0)

            # Fetch from CoinGecko
            url = f"https://api.coingecko.com/api/v3/coins/{symbol}"
            response = await self._http_client.get(url)
            response.raise_for_status()
            data = response.json()

            market_data = MarketData(
                symbol=data.get("symbol", "").upper(),
                price_usd=Decimal(str(data.get("market_data", {}).get("current_price", {}).get("usd", 0))),
                price_change_24h=Decimal(str(data.get("market_data", {}).get("price_change_percentage_24h", 0))),
                volume_24h=Decimal(str(data.get("market_data", {}).get("total_volume", {}).get("usd", 0))),
                market_cap=Decimal(str(data.get("market_data", {}).get("market_cap", {}).get("usd", 0))),
                timestamp=datetime.utcnow()
            )

            self._cache[cache_key] = market_data
            self._cache_timestamps[cache_key] = datetime.utcnow()

            return market_data

        except Exception as e:
            logger.warning("Failed to fetch market data, using defaults", error=str(e))
            return MarketData(
                symbol="CSPR",
                price_usd=Decimal("0.05"),
                price_change_24h=Decimal("0"),
                volume_24h=Decimal("10000000"),
                market_cap=Decimal("500000000"),
                timestamp=datetime.utcnow()
            )

    async def get_all_strategy_metrics(self) -> List[StrategyMetrics]:
        """Get comprehensive metrics for all strategies.

        Returns:
            List of StrategyMetrics objects
        """
        cache_key = "all_strategy_metrics"
        if self._is_cache_valid(cache_key):
            return self._cache[cache_key]

        strategies = await self.contract_client.get_all_strategies()
        metrics = []

        for strategy in strategies:
            strategy_metrics = await self._calculate_strategy_metrics(strategy)
            metrics.append(strategy_metrics)

        self._cache[cache_key] = metrics
        self._cache_timestamps[cache_key] = datetime.utcnow()

        return metrics

    async def _calculate_strategy_metrics(self, strategy: StrategyInfo) -> StrategyMetrics:
        """Calculate comprehensive metrics for a strategy.

        Args:
            strategy: Strategy information

        Returns:
            StrategyMetrics object
        """
        # Get historical data
        history = await self.contract_client.get_historical_apy(
            strategy.strategy_id,
            days=30
        )

        # Calculate average APYs
        if history:
            apys = [h["apy"] for h in history]
            avg_apy_7d = Decimal(str(sum(apys[-7:]) / len(apys[-7:]))) if len(apys) >= 7 else strategy.apy
            avg_apy_30d = Decimal(str(sum(apys) / len(apys)))
        else:
            avg_apy_7d = strategy.apy
            avg_apy_30d = strategy.apy

        # Calculate volatility (standard deviation of returns)
        volatility = self._calculate_volatility(history)

        # Calculate Sharpe ratio
        risk_free_rate = Decimal(str(self.config.get("risk", {}).get("risk_free_rate", 0.02)))
        sharpe = self._calculate_sharpe_ratio(strategy.apy, volatility, risk_free_rate)

        # Calculate max drawdown
        max_drawdown = self._calculate_max_drawdown(history)

        # Estimate TVL change (mock for now)
        tvl_change_24h = Decimal("0.02")  # 2% increase

        # Estimate protocol age (mock for now)
        protocol_age = self._estimate_protocol_age(strategy.strategy_type)

        return StrategyMetrics(
            strategy_id=strategy.strategy_id,
            name=strategy.name,
            strategy_type=strategy.strategy_type,
            current_apy=strategy.apy,
            avg_apy_7d=avg_apy_7d,
            avg_apy_30d=avg_apy_30d,
            tvl=strategy.tvl,
            tvl_change_24h=tvl_change_24h,
            risk_score=strategy.risk_score,
            volatility=volatility,
            sharpe_ratio=sharpe,
            max_drawdown=max_drawdown,
            protocol_age_days=protocol_age
        )

    def _calculate_volatility(self, history: List[Dict[str, Any]]) -> Decimal:
        """Calculate annualized volatility from historical data.

        Args:
            history: Historical APY data

        Returns:
            Annualized volatility
        """
        if len(history) < 2:
            return Decimal("0.1")  # Default volatility

        apys = [h["apy"] for h in history]
        mean = sum(apys) / len(apys)

        # Calculate variance
        variance = sum((apy - mean) ** 2 for apy in apys) / len(apys)

        # Standard deviation (daily)
        std_dev = variance ** 0.5

        # Annualize (sqrt of 365)
        annualized = std_dev * (365 ** 0.5)

        return Decimal(str(min(annualized, 1.0)))  # Cap at 100%

    def _calculate_sharpe_ratio(
        self,
        apy: Decimal,
        volatility: Decimal,
        risk_free_rate: Decimal
    ) -> Decimal:
        """Calculate Sharpe ratio.

        Args:
            apy: Annual percentage yield
            volatility: Annualized volatility
            risk_free_rate: Risk-free rate

        Returns:
            Sharpe ratio
        """
        if volatility == 0:
            return Decimal("0")

        excess_return = apy - risk_free_rate
        return excess_return / volatility

    def _calculate_max_drawdown(self, history: List[Dict[str, Any]]) -> Decimal:
        """Calculate maximum drawdown from TVL history.

        Args:
            history: Historical data

        Returns:
            Maximum drawdown as decimal
        """
        if len(history) < 2:
            return Decimal("0.05")  # Default 5% drawdown

        tvls = [h.get("tvl", 0) for h in history]
        if not any(tvls):
            return Decimal("0.05")

        peak = tvls[0]
        max_drawdown = 0

        for tvl in tvls:
            if tvl > peak:
                peak = tvl
            drawdown = (peak - tvl) / peak if peak > 0 else 0
            max_drawdown = max(max_drawdown, drawdown)

        return Decimal(str(max_drawdown))

    def _estimate_protocol_age(self, strategy_type: str) -> int:
        """Estimate protocol age based on strategy type.

        Args:
            strategy_type: Type of strategy

        Returns:
            Estimated age in days
        """
        # Mock ages for different strategy types
        ages = {
            "staking": 365,  # Native staking is as old as the chain
            "lending": 180,  # Lending protocols launched later
            "liquidity": 90,  # LP strategies are newer
        }
        return ages.get(strategy_type, 60)

    async def get_network_stats(self) -> Dict[str, Any]:
        """Get Casper network statistics.

        Returns:
            Network statistics
        """
        cache_key = "network_stats"
        if self._is_cache_valid(cache_key):
            return self._cache[cache_key]

        try:
            # Get latest block
            block = await self.casper_client.get_latest_block()

            # Get validator info
            validators = await self.casper_client.get_validator_info()

            # Calculate network stats
            total_stake = sum(v["staked_amount"] for v in validators)
            active_validators = len([v for v in validators if not v.get("inactive", False)])

            stats = {
                "block_height": block.height,
                "era_id": block.era_id,
                "total_stake": total_stake,
                "active_validators": active_validators,
                "avg_delegation_rate": sum(v["delegation_rate"] for v in validators) / len(validators) if validators else 0,
                "timestamp": datetime.utcnow().isoformat()
            }

            self._cache[cache_key] = stats
            self._cache_timestamps[cache_key] = datetime.utcnow()

            return stats

        except Exception as e:
            logger.warning("Failed to fetch network stats", error=str(e))
            return {
                "block_height": 0,
                "era_id": 0,
                "total_stake": 0,
                "active_validators": 0,
                "avg_delegation_rate": 0,
                "timestamp": datetime.utcnow().isoformat()
            }

    async def get_strategy_comparison(self) -> Dict[str, Any]:
        """Get comparison data for all strategies.

        Returns:
            Comparison data dictionary
        """
        metrics = await self.get_all_strategy_metrics()

        return {
            "strategies": [
                {
                    "id": m.strategy_id,
                    "name": m.name,
                    "type": m.strategy_type,
                    "apy": float(m.current_apy),
                    "tvl": float(m.tvl),
                    "risk_score": m.risk_score,
                    "sharpe_ratio": float(m.sharpe_ratio),
                    "volatility": float(m.volatility)
                }
                for m in metrics
            ],
            "best_apy": max(metrics, key=lambda m: m.current_apy).strategy_id if metrics else None,
            "lowest_risk": min(metrics, key=lambda m: m.risk_score).strategy_id if metrics else None,
            "best_sharpe": max(metrics, key=lambda m: m.sharpe_ratio).strategy_id if metrics else None,
            "timestamp": datetime.utcnow().isoformat()
        }
