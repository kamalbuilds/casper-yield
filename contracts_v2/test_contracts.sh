#!/bin/bash

# CasperYield Contract Testing Script
# Tests all contract functionalities on Casper Testnet

NODE_URL="https://node.testnet.casper.network/rpc"
CHAIN_NAME="casper-test"
SECRET_KEY="secret_key.pem"

# Contract Hashes
VAULT_MANAGER="hash-6952ca3951a9d642adea164988747ef599e253168a80c259f6dd1c83904e82fb"
STRATEGY_ROUTER="hash-da43f7ac94627dbbb0429a23d16d25b478e53d79d84ec71286cc23e0e8fd5d17"
SCSPR_STRATEGY="hash-6e5ea833c203ddeb273b08b778f3b5fbbc44dfe7437cfef8dcad05d7d152159f"
DEX_LP_STRATEGY="hash-12ccd245f829446142b1322175fb8ca4c7a9df58c229155e6bcd38ea8df06eff"

ACCOUNT_HASH="account-hash-c7c7f8f9439978b9a997fd9c101cd1f7dfe2ca8bcadc612f9329deb97fb31db8"

echo "==========================================="
echo "CasperYield Contract Testing"
echo "==========================================="

# Function to call contract entry point
call_contract() {
    local contract=$1
    local entry_point=$2
    local payment=$3
    shift 3
    local args="$@"

    echo "Calling $entry_point on $contract..."
    casper-client put-transaction session \
        --node-address "$NODE_URL" \
        --chain-name "$CHAIN_NAME" \
        --secret-key "$SECRET_KEY" \
        --payment-amount "$payment" \
        --gas-price-tolerance 10 \
        --standard-payment true \
        --session-entry-point "$entry_point" \
        --session-hash "$contract" \
        $args 2>&1
}

# Function to query contract state
query_contract() {
    local key=$1
    local state_root=$(casper-client get-state-root-hash --node-address "$NODE_URL" | jq -r '.result.state_root_hash')
    casper-client query-global-state \
        --node-address "$NODE_URL" \
        --state-root-hash "$state_root" \
        --key "$key" 2>&1
}

echo ""
echo "=== Test 1: Query VaultManager State ==="
query_contract "$VAULT_MANAGER"

echo ""
echo "=== Test 2: Query VaultManager - get_total_assets ==="
call_contract "$VAULT_MANAGER" "get_total_assets" "5000000000"

echo ""
echo "=== Test 3: Query VaultManager - get_share_price ==="
call_contract "$VAULT_MANAGER" "get_share_price" "5000000000"

echo ""
echo "=== Test 4: Query VaultManager - total_supply ==="
call_contract "$VAULT_MANAGER" "total_supply" "5000000000"

echo ""
echo "=== Test 5: Query VaultManager - balance_of ==="
call_contract "$VAULT_MANAGER" "balance_of" "5000000000" \
    --session-arg "account:key='$ACCOUNT_HASH'"

echo ""
echo "=== Test 6: Deposit to VaultManager (10 CSPR) ==="
call_contract "$VAULT_MANAGER" "deposit" "50000000000" \
    --transferred-value 10000000000

echo ""
echo "=== Test 7: Query SCsprStrategy State ==="
query_contract "$SCSPR_STRATEGY"

echo ""
echo "=== Test 8: Query DexLpStrategy State ==="
query_contract "$DEX_LP_STRATEGY"

echo ""
echo "==========================================="
echo "Testing Complete!"
echo "==========================================="
