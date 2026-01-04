"""Casper RPC client for blockchain interactions."""

import asyncio
from typing import Any, Dict, List, Optional
from dataclasses import dataclass
import httpx
import structlog

logger = structlog.get_logger()


@dataclass
class BlockInfo:
    """Block information."""
    height: int
    hash: str
    timestamp: str
    era_id: int


@dataclass
class AccountInfo:
    """Account information."""
    account_hash: str
    main_purse: str
    balance: int


class CasperClient:
    """Async client for Casper RPC interactions."""

    def __init__(self, rpc_url: str, chain_name: str = "casper-test"):
        """Initialize Casper client.

        Args:
            rpc_url: URL of the Casper RPC endpoint
            chain_name: Name of the Casper chain
        """
        self.rpc_url = rpc_url
        self.chain_name = chain_name
        self._client: Optional[httpx.AsyncClient] = None
        self._request_id = 0

    async def __aenter__(self):
        """Async context manager entry."""
        self._client = httpx.AsyncClient(timeout=30.0)
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit."""
        if self._client:
            await self._client.aclose()

    def _get_request_id(self) -> int:
        """Get unique request ID."""
        self._request_id += 1
        return self._request_id

    async def _rpc_call(self, method: str, params: Optional[Dict] = None) -> Dict[str, Any]:
        """Make an RPC call to the Casper node.

        Args:
            method: RPC method name
            params: Optional parameters

        Returns:
            RPC response result
        """
        if not self._client:
            self._client = httpx.AsyncClient(timeout=30.0)

        payload = {
            "jsonrpc": "2.0",
            "id": self._get_request_id(),
            "method": method,
            "params": params or {}
        }

        try:
            response = await self._client.post(self.rpc_url, json=payload)
            response.raise_for_status()
            result = response.json()

            if "error" in result:
                raise Exception(f"RPC Error: {result['error']}")

            return result.get("result", {})

        except httpx.HTTPError as e:
            logger.error("RPC call failed", method=method, error=str(e))
            raise

    async def get_latest_block(self) -> BlockInfo:
        """Get the latest block information.

        Returns:
            BlockInfo with latest block details
        """
        result = await self._rpc_call("chain_get_block")
        block = result.get("block", {})
        header = block.get("header", {})

        return BlockInfo(
            height=header.get("height", 0),
            hash=block.get("hash", ""),
            timestamp=header.get("timestamp", ""),
            era_id=header.get("era_id", 0)
        )

    async def get_block_by_height(self, height: int) -> BlockInfo:
        """Get block information by height.

        Args:
            height: Block height

        Returns:
            BlockInfo for the specified block
        """
        result = await self._rpc_call(
            "chain_get_block",
            {"block_identifier": {"Height": height}}
        )
        block = result.get("block", {})
        header = block.get("header", {})

        return BlockInfo(
            height=header.get("height", height),
            hash=block.get("hash", ""),
            timestamp=header.get("timestamp", ""),
            era_id=header.get("era_id", 0)
        )

    async def get_account_balance(self, account_hash: str) -> int:
        """Get account balance.

        Args:
            account_hash: Account hash (without 'account-hash-' prefix)

        Returns:
            Balance in motes
        """
        # First get the state root hash
        block = await self.get_latest_block()

        # Get account info to find the main purse
        result = await self._rpc_call(
            "state_get_account_info",
            {
                "block_identifier": {"Hash": block.hash},
                "account_identifier": {"AccountHash": f"account-hash-{account_hash}"}
            }
        )

        account = result.get("account", {})
        main_purse = account.get("main_purse", "")

        if not main_purse:
            return 0

        # Get the balance
        balance_result = await self._rpc_call(
            "state_get_balance",
            {
                "state_root_hash": result.get("merkle_proof", ""),
                "purse_uref": main_purse
            }
        )

        return int(balance_result.get("balance_value", 0))

    async def get_state_item(
        self,
        key: str,
        path: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """Get item from global state.

        Args:
            key: State key
            path: Optional path within the state

        Returns:
            State item data
        """
        block = await self.get_latest_block()

        params = {
            "state_root_hash": "",  # Will be fetched
            "key": key,
        }

        if path:
            params["path"] = path

        # Get state root hash from latest block
        block_result = await self._rpc_call(
            "chain_get_block",
            {"block_identifier": {"Hash": block.hash}}
        )
        params["state_root_hash"] = block_result.get("block", {}).get("header", {}).get("state_root_hash", "")

        result = await self._rpc_call("state_get_item", params)
        return result.get("stored_value", {})

    async def get_era_info(self) -> Dict[str, Any]:
        """Get current era information.

        Returns:
            Era information including validators
        """
        result = await self._rpc_call("chain_get_era_info_by_switch_block")
        return result.get("era_summary", {})

    async def get_validator_info(self) -> List[Dict[str, Any]]:
        """Get current validator information.

        Returns:
            List of validator information
        """
        result = await self._rpc_call("state_get_auction_info")
        auction_state = result.get("auction_state", {})
        bids = auction_state.get("bids", [])

        validators = []
        for bid in bids:
            public_key = bid.get("public_key", "")
            bid_info = bid.get("bid", {})

            validators.append({
                "public_key": public_key,
                "staked_amount": int(bid_info.get("staked_amount", 0)),
                "delegation_rate": bid_info.get("delegation_rate", 0),
                "inactive": bid_info.get("inactive", False),
            })

        return validators

    async def get_deploy_info(self, deploy_hash: str) -> Dict[str, Any]:
        """Get deploy information.

        Args:
            deploy_hash: Deploy hash

        Returns:
            Deploy information
        """
        result = await self._rpc_call(
            "info_get_deploy",
            {"deploy_hash": deploy_hash}
        )
        return result

    async def get_node_status(self) -> Dict[str, Any]:
        """Get node status.

        Returns:
            Node status information
        """
        result = await self._rpc_call("info_get_status")
        return result

    async def query_contract_dict(
        self,
        contract_hash: str,
        dict_name: str,
        dict_key: str
    ) -> Dict[str, Any]:
        """Query a contract's named key dictionary.

        Args:
            contract_hash: Contract hash
            dict_name: Dictionary name
            dict_key: Key within the dictionary

        Returns:
            Dictionary item value
        """
        block = await self.get_latest_block()

        # Get state root hash
        block_result = await self._rpc_call(
            "chain_get_block",
            {"block_identifier": {"Hash": block.hash}}
        )
        state_root_hash = block_result.get("block", {}).get("header", {}).get("state_root_hash", "")

        result = await self._rpc_call(
            "state_get_dictionary_item",
            {
                "state_root_hash": state_root_hash,
                "dictionary_identifier": {
                    "ContractNamedKey": {
                        "key": contract_hash,
                        "dictionary_name": dict_name,
                        "dictionary_item_key": dict_key
                    }
                }
            }
        )

        return result.get("stored_value", {})
