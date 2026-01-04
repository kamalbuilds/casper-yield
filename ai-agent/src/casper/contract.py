"""Contract interaction client for CasperYield contracts."""

from typing import Any, Dict, List, Optional
from dataclasses import dataclass
from decimal import Decimal
import structlog

from .client import CasperClient

logger = structlog.get_logger()


@dataclass
class StrategyInfo:
    """Strategy information from on-chain."""
    strategy_id: str
    name: str
    strategy_type: str
    apy: Decimal
    tvl: Decimal
    is_active: bool
    risk_score: int
    last_harvest: int


@dataclass
class VaultInfo:
    """Vault information from on-chain."""
    vault_address: str
    total_assets: Decimal
    total_shares: Decimal
    strategies: List[str]
    performance_fee: Decimal
    management_fee: Decimal


@dataclass
class UserPosition:
    """User position information."""
    user: str
    vault: str
    shares: Decimal
    assets: Decimal
    pending_rewards: Decimal


class ContractClient:
    """Client for interacting with CasperYield smart contracts."""

    def __init__(
        self,
        casper_client: CasperClient,
        vault_factory_hash: str,
        strategy_registry_hash: str,
        oracle_hash: str
    ):
        """Initialize contract client.

        Args:
            casper_client: CasperClient instance
            vault_factory_hash: Hash of the vault factory contract
            strategy_registry_hash: Hash of the strategy registry contract
            oracle_hash: Hash of the oracle contract
        """
        self.client = casper_client
        self.vault_factory_hash = vault_factory_hash
        self.strategy_registry_hash = strategy_registry_hash
        self.oracle_hash = oracle_hash

    async def get_all_strategies(self) -> List[StrategyInfo]:
        """Get all registered strategies.

        Returns:
            List of StrategyInfo objects
        """
        try:
            # Query the strategy registry for all strategies
            # This is a simplified version - actual implementation depends on contract structure
            result = await self.client.get_state_item(
                self.strategy_registry_hash,
                ["strategies"]
            )

            strategies = []
            strategy_data = result.get("CLValue", {}).get("parsed", [])

            for data in strategy_data:
                strategies.append(StrategyInfo(
                    strategy_id=data.get("id", ""),
                    name=data.get("name", ""),
                    strategy_type=data.get("type", ""),
                    apy=Decimal(str(data.get("apy", 0))) / Decimal("10000"),  # Convert from basis points
                    tvl=Decimal(str(data.get("tvl", 0))) / Decimal("1000000000"),  # Convert from motes
                    is_active=data.get("is_active", True),
                    risk_score=data.get("risk_score", 50),
                    last_harvest=data.get("last_harvest", 0)
                ))

            return strategies

        except Exception as e:
            logger.warning("Failed to fetch strategies from chain, using mock data", error=str(e))
            # Return mock data for development/testing
            return self._get_mock_strategies()

    def _get_mock_strategies(self) -> List[StrategyInfo]:
        """Get mock strategy data for development.

        Returns:
            List of mock StrategyInfo objects
        """
        return [
            StrategyInfo(
                strategy_id="staking",
                name="Native Staking",
                strategy_type="staking",
                apy=Decimal("0.08"),  # 8%
                tvl=Decimal("5000000"),
                is_active=True,
                risk_score=20,
                last_harvest=0
            ),
            StrategyInfo(
                strategy_id="lending",
                name="Lending Protocol",
                strategy_type="lending",
                apy=Decimal("0.12"),  # 12%
                tvl=Decimal("2000000"),
                is_active=True,
                risk_score=40,
                last_harvest=0
            ),
            StrategyInfo(
                strategy_id="lp",
                name="Liquidity Provision",
                strategy_type="liquidity",
                apy=Decimal("0.25"),  # 25%
                tvl=Decimal("1000000"),
                is_active=True,
                risk_score=60,
                last_harvest=0
            ),
        ]

    async def get_strategy_by_id(self, strategy_id: str) -> Optional[StrategyInfo]:
        """Get a specific strategy by ID.

        Args:
            strategy_id: Strategy identifier

        Returns:
            StrategyInfo if found, None otherwise
        """
        try:
            result = await self.client.query_contract_dict(
                self.strategy_registry_hash,
                "strategies",
                strategy_id
            )

            data = result.get("CLValue", {}).get("parsed", {})
            if not data:
                return None

            return StrategyInfo(
                strategy_id=strategy_id,
                name=data.get("name", ""),
                strategy_type=data.get("type", ""),
                apy=Decimal(str(data.get("apy", 0))) / Decimal("10000"),
                tvl=Decimal(str(data.get("tvl", 0))) / Decimal("1000000000"),
                is_active=data.get("is_active", True),
                risk_score=data.get("risk_score", 50),
                last_harvest=data.get("last_harvest", 0)
            )

        except Exception as e:
            logger.warning("Failed to fetch strategy, using mock", strategy_id=strategy_id, error=str(e))
            mock_strategies = self._get_mock_strategies()
            for s in mock_strategies:
                if s.strategy_id == strategy_id:
                    return s
            return None

    async def get_vault_info(self, vault_address: str) -> Optional[VaultInfo]:
        """Get vault information.

        Args:
            vault_address: Vault contract address

        Returns:
            VaultInfo if found, None otherwise
        """
        try:
            result = await self.client.get_state_item(vault_address)
            data = result.get("Contract", {}).get("named_keys", {})

            return VaultInfo(
                vault_address=vault_address,
                total_assets=Decimal(str(data.get("total_assets", 0))),
                total_shares=Decimal(str(data.get("total_shares", 0))),
                strategies=data.get("strategies", []),
                performance_fee=Decimal(str(data.get("performance_fee", 0))) / Decimal("10000"),
                management_fee=Decimal(str(data.get("management_fee", 0))) / Decimal("10000"),
            )

        except Exception as e:
            logger.warning("Failed to fetch vault info", vault=vault_address, error=str(e))
            return None

    async def get_user_position(self, user: str, vault: str) -> Optional[UserPosition]:
        """Get user's position in a vault.

        Args:
            user: User account hash
            vault: Vault address

        Returns:
            UserPosition if found, None otherwise
        """
        try:
            result = await self.client.query_contract_dict(
                vault,
                "positions",
                user
            )

            data = result.get("CLValue", {}).get("parsed", {})
            if not data:
                return None

            return UserPosition(
                user=user,
                vault=vault,
                shares=Decimal(str(data.get("shares", 0))),
                assets=Decimal(str(data.get("assets", 0))),
                pending_rewards=Decimal(str(data.get("pending_rewards", 0)))
            )

        except Exception as e:
            logger.warning("Failed to fetch user position", user=user, vault=vault, error=str(e))
            return None

    async def get_current_apy(self, strategy_id: str) -> Decimal:
        """Get current APY for a strategy.

        Args:
            strategy_id: Strategy identifier

        Returns:
            Current APY as decimal (e.g., 0.08 for 8%)
        """
        strategy = await self.get_strategy_by_id(strategy_id)
        if strategy:
            return strategy.apy
        return Decimal("0")

    async def get_historical_apy(
        self,
        strategy_id: str,
        days: int = 30
    ) -> List[Dict[str, Any]]:
        """Get historical APY data for a strategy.

        Args:
            strategy_id: Strategy identifier
            days: Number of days of history

        Returns:
            List of historical APY data points
        """
        # In a real implementation, this would query historical data from
        # an indexer or event logs. For now, return mock data.
        import random
        from datetime import datetime, timedelta

        base_apy = {
            "staking": 0.08,
            "lending": 0.12,
            "lp": 0.25
        }.get(strategy_id, 0.10)

        history = []
        for i in range(days):
            date = datetime.utcnow() - timedelta(days=days - i)
            # Add some variance
            variance = (random.random() - 0.5) * 0.02
            apy = base_apy + variance

            history.append({
                "date": date.isoformat(),
                "apy": max(0, apy),
                "tvl": random.uniform(1000000, 5000000)
            })

        return history

    async def get_price(self, token: str) -> Decimal:
        """Get token price from oracle.

        Args:
            token: Token symbol or address

        Returns:
            Token price in USD
        """
        try:
            result = await self.client.query_contract_dict(
                self.oracle_hash,
                "prices",
                token
            )

            price = result.get("CLValue", {}).get("parsed", 0)
            return Decimal(str(price)) / Decimal("1000000")  # 6 decimal precision

        except Exception as e:
            logger.warning("Failed to fetch price from oracle", token=token, error=str(e))
            # Return mock price for CSPR
            if token.upper() == "CSPR":
                return Decimal("0.05")  # $0.05
            return Decimal("1.0")

    async def get_total_tvl(self) -> Decimal:
        """Get total TVL across all strategies.

        Returns:
            Total TVL in USD
        """
        strategies = await self.get_all_strategies()
        total = sum(s.tvl for s in strategies)
        return total

    async def estimate_rewards(
        self,
        strategy_id: str,
        amount: Decimal,
        days: int
    ) -> Decimal:
        """Estimate rewards for a given deposit.

        Args:
            strategy_id: Strategy identifier
            amount: Deposit amount
            days: Number of days

        Returns:
            Estimated rewards
        """
        strategy = await self.get_strategy_by_id(strategy_id)
        if not strategy:
            return Decimal("0")

        # Simple compound interest calculation
        daily_rate = strategy.apy / Decimal("365")
        return amount * (((Decimal("1") + daily_rate) ** days) - Decimal("1"))
