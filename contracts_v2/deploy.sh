#!/bin/bash
# CasperYield Contract Deployment Script for Casper 2.0 Testnet
# This script deploys all contracts using casper-client

set -e

# Configuration
NODE_ADDRESS="https://node.testnet.casper.network/rpc"
CHAIN_NAME="casper-test"
SECRET_KEY="./secret_key.pem"
TTL="30min"

# Gas prices for Casper 2.0 (in motes, 1 CSPR = 1,000,000,000 motes)
# Contract deployment requires significant gas
PAYMENT_AMOUNT="300000000000"  # 300 CSPR

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "=============================================="
echo "CasperYield Contract Deployment"
echo "=============================================="
echo ""

# Check prerequisites
echo -e "${YELLOW}Checking prerequisites...${NC}"

if ! command -v casper-client &> /dev/null; then
    echo -e "${RED}Error: casper-client not found. Please install it first.${NC}"
    exit 1
fi

if [ ! -f "$SECRET_KEY" ]; then
    echo -e "${RED}Error: Secret key not found at $SECRET_KEY${NC}"
    exit 1
fi

# Get public key from secret key
PUBLIC_KEY=$(casper-client account-address --public-key "$SECRET_KEY" 2>/dev/null | grep -oP '(?<=account-hash-)[a-f0-9]+' || echo "")
if [ -z "$PUBLIC_KEY" ]; then
    # Alternative method to get public key
    PUBLIC_KEY_HEX=$(openssl ec -in "$SECRET_KEY" -pubout -outform DER 2>/dev/null | tail -c 32 | xxd -p -c 64 || echo "")
fi

echo -e "${GREEN}Using node: $NODE_ADDRESS${NC}"
echo -e "${GREEN}Chain: $CHAIN_NAME${NC}"
echo ""

# Check account balance
echo -e "${YELLOW}Checking account balance...${NC}"
BALANCE_RESULT=$(casper-client query-balance \
    --node-address "$NODE_ADDRESS" \
    --purse-identifier "main-purse-under-public-key" \
    --public-key "$SECRET_KEY" 2>&1 || echo "FAILED")

if [[ "$BALANCE_RESULT" == *"FAILED"* ]] || [[ "$BALANCE_RESULT" == *"not found"* ]]; then
    echo -e "${RED}Account not found or has no balance!${NC}"
    echo ""
    echo "Please fund your account first:"
    echo "1. Go to https://testnet.cspr.live/tools/faucet"
    echo "2. Connect your Casper Wallet with the mnemonic phrase"
    echo "3. Request 1000 CSPR from the faucet"
    echo ""
    echo "Your public key: 01c5d9be1c30f5ce0e4d1dd2473cc7643e8b7c15bd19023bf5986b09785392714d"
    echo "Account hash: 0a3ecf18fc2001e44a0eba79be324698599a8f74b34a8122f50b979cc40d8315"
    exit 1
fi

echo -e "${GREEN}Account has balance: $BALANCE_RESULT${NC}"
echo ""

# Function to deploy a contract
deploy_contract() {
    local contract_name=$1
    local wasm_file=$2

    echo -e "${YELLOW}Deploying $contract_name...${NC}"

    if [ ! -f "$wasm_file" ]; then
        echo -e "${RED}Error: WASM file not found: $wasm_file${NC}"
        return 1
    fi

    # Use put-transaction for Casper 2.0
    RESULT=$(casper-client put-transaction session \
        --node-address "$NODE_ADDRESS" \
        --chain-name "$CHAIN_NAME" \
        --secret-key "$SECRET_KEY" \
        --payment-amount "$PAYMENT_AMOUNT" \
        --session-path "$wasm_file" \
        --ttl "$TTL" \
        --is-install-upgrade \
        2>&1)

    if [[ "$RESULT" == *"error"* ]]; then
        echo -e "${RED}Deployment failed: $RESULT${NC}"
        return 1
    fi

    # Extract transaction hash
    TX_HASH=$(echo "$RESULT" | grep -oP '(?<="transaction_hash": ")[^"]+' || echo "")

    if [ -n "$TX_HASH" ]; then
        echo -e "${GREEN}Transaction submitted: $TX_HASH${NC}"
        echo "$contract_name=$TX_HASH" >> deployment_results.txt

        # Wait for transaction to be processed
        echo "Waiting for transaction to be processed..."
        sleep 30

        # Check transaction status
        casper-client get-transaction \
            --node-address "$NODE_ADDRESS" \
            --transaction-hash "$TX_HASH" 2>&1 | head -20
    else
        echo -e "${YELLOW}Result: $RESULT${NC}"
    fi

    echo ""
}

# Clear previous deployment results
> deployment_results.txt

echo "=============================================="
echo "Starting Contract Deployments"
echo "=============================================="
echo ""

# Deploy contracts
deploy_contract "VaultManager" "./wasm/VaultManager.wasm"
deploy_contract "StrategyRouter" "./wasm/StrategyRouter.wasm"
deploy_contract "SCsprStrategy" "./wasm/SCsprStrategy.wasm"
deploy_contract "DexLpStrategy" "./wasm/DexLpStrategy.wasm"

echo "=============================================="
echo "Deployment Complete"
echo "=============================================="
echo ""
echo "Results saved to deployment_results.txt"
cat deployment_results.txt 2>/dev/null || echo "No results yet"
echo ""
echo "View your contracts at: https://testnet.cspr.live/contracts"
