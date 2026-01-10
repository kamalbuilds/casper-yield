#!/usr/bin/env python3
"""
CasperYield Contract Deployment Script
Deploys all contracts to Casper testnet using direct RPC calls
"""

import json
import hashlib
import time
import base64
import struct
import subprocess
import sys
from pathlib import Path

# Configuration
NODE_ADDRESS = "https://node.testnet.casper.network/rpc"
CHAIN_NAME = "casper-test"
SECRET_KEY_PATH = "./secret_key.pem"
PAYMENT_AMOUNT = 300_000_000_000  # 300 CSPR in motes

# Contract WASM files
CONTRACTS = [
    ("VaultManager", "./wasm/VaultManager.wasm"),
    ("StrategyRouter", "./wasm/StrategyRouter.wasm"),
    ("SCsprStrategy", "./wasm/SCsprStrategy.wasm"),
    ("DexLpStrategy", "./wasm/DexLpStrategy.wasm"),
]

def run_casper_client(args):
    """Run casper-client command and return output"""
    cmd = ["casper-client"] + args
    print(f"Running: {' '.join(cmd[:5])}...")
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
        if result.returncode != 0:
            print(f"Error: {result.stderr}")
            return None
        return result.stdout
    except subprocess.TimeoutExpired:
        print("Command timed out")
        return None
    except FileNotFoundError:
        print("casper-client not found. Please install it first.")
        return None

PUBLIC_KEY = "01c5d9be1c30f5ce0e4d1dd2473cc7643e8b7c15bd19023bf5986b09785392714d"
ACCOUNT_HASH = "0a3ecf18fc2001e44a0eba79be324698599a8f74b34a8122f50b979cc40d8315"

def check_balance():
    """Check account balance"""
    result = run_casper_client([
        "query-balance",
        "--node-address", NODE_ADDRESS,
        "--purse-identifier", PUBLIC_KEY
    ])
    return result

def deploy_contract(name, wasm_path):
    """Deploy a single contract"""
    print(f"\n{'='*50}")
    print(f"Deploying {name}")
    print(f"{'='*50}")

    if not Path(wasm_path).exists():
        print(f"Error: WASM file not found: {wasm_path}")
        return None

    wasm_size = Path(wasm_path).stat().st_size
    print(f"WASM size: {wasm_size:,} bytes")

    # Use put-transaction for Casper 2.0
    result = run_casper_client([
        "put-transaction", "session",
        "--node-address", NODE_ADDRESS,
        "--chain-name", CHAIN_NAME,
        "--secret-key", SECRET_KEY_PATH,
        "--payment-amount", str(PAYMENT_AMOUNT),
        "--session-path", wasm_path,
        "--ttl", "30min",
        "--is-install-upgrade"
    ])

    if result:
        # Try to extract transaction hash
        try:
            data = json.loads(result)
            tx_hash = data.get("result", {}).get("transaction_hash", "")
            if tx_hash:
                print(f"Transaction hash: {tx_hash}")
                return tx_hash
        except json.JSONDecodeError:
            pass
        print(f"Result: {result[:500]}")

    return None

def wait_for_transaction(tx_hash, timeout=120):
    """Wait for transaction to be processed"""
    print(f"Waiting for transaction {tx_hash[:16]}... to be processed")
    start = time.time()

    while time.time() - start < timeout:
        result = run_casper_client([
            "get-transaction",
            "--node-address", NODE_ADDRESS,
            "--transaction-hash", tx_hash
        ])

        if result and "Success" in result:
            print("Transaction succeeded!")
            return True
        elif result and "Failure" in result:
            print("Transaction failed!")
            return False

        time.sleep(5)

    print("Timeout waiting for transaction")
    return False

def get_contract_hash(account_hash, contract_name):
    """Query contract hash from account's named keys"""
    result = run_casper_client([
        "query-global-state",
        "--node-address", NODE_ADDRESS,
        "--key", f"account-hash-{account_hash}",
        "--query-path", ""
    ])

    if result:
        # Parse named keys to find contract
        # This is a simplified version
        print(f"Querying contract hash for {contract_name}...")

    return None

def main():
    print("="*60)
    print("CasperYield Contract Deployment")
    print("="*60)
    print(f"Node: {NODE_ADDRESS}")
    print(f"Chain: {CHAIN_NAME}")
    print()

    # Check prerequisites
    if not Path(SECRET_KEY_PATH).exists():
        print(f"Error: Secret key not found at {SECRET_KEY_PATH}")
        sys.exit(1)

    # Check balance
    print("Checking account balance...")
    balance = check_balance()

    if not balance or "not found" in balance.lower() or "error" in balance.lower():
        print("\n" + "="*60)
        print("ACCOUNT NOT FUNDED!")
        print("="*60)
        print()
        print("Please fund your account first:")
        print()
        print("1. Install Casper Wallet browser extension")
        print("2. Import your mnemonic into the wallet:")
        print("   'assume unlock board ugly road miss seed seed right still")
        print("    trouble pulp shed auto earn token cause sentence tool blue")
        print("    enforce fever notice before'")
        print()
        print("3. Go to https://testnet.cspr.live/tools/faucet")
        print("4. Connect your wallet and request tokens")
        print()
        print("Your account details:")
        print("  Public key: 01c5d9be1c30f5ce0e4d1dd2473cc7643e8b7c15bd19023bf5986b09785392714d")
        print("  Account hash: 0a3ecf18fc2001e44a0eba79be324698599a8f74b34a8122f50b979cc40d8315")
        print()
        print("After funding, run this script again.")
        sys.exit(1)

    print(f"Balance: {balance}")

    # Deploy contracts
    deployment_results = {}

    for name, wasm_path in CONTRACTS:
        tx_hash = deploy_contract(name, wasm_path)
        if tx_hash:
            deployment_results[name] = tx_hash
            # Wait for transaction
            success = wait_for_transaction(tx_hash)
            if not success:
                print(f"Warning: {name} deployment may have failed")
        else:
            print(f"Failed to submit {name} deployment")

    # Save results
    print("\n" + "="*60)
    print("Deployment Results")
    print("="*60)

    results_file = Path("deployment_results.json")
    with open(results_file, "w") as f:
        json.dump(deployment_results, f, indent=2)

    print(f"\nResults saved to {results_file}")
    print("\nTransaction hashes:")
    for name, tx_hash in deployment_results.items():
        print(f"  {name}: {tx_hash}")

    print("\nView on explorer:")
    print("  https://testnet.cspr.live/transactions")

if __name__ == "__main__":
    main()
