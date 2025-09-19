#!/bin/bash

# Spawn.fun Deployment Script
# Supports multiple networks and environments

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
NETWORK=""
ENVIRONMENT="development"
VERIFY_CONTRACTS="true"
DEPLOY_TEST_TOKEN="false"
PRIVATE_KEY=""

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to show usage
show_usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -n, --network NETWORK      Target network (somnia-testnet, somnia-mainnet, local)"
    echo "  -e, --environment ENV      Environment (development, staging, production)"
    echo "  -k, --private-key KEY      Private key for deployment (or set PRIVATE_KEY env var)"
    echo "  --no-verify               Skip contract verification"
    echo "  --deploy-test-token       Deploy a test token after factory deployment"
    echo "  -h, --help                Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 -n somnia-testnet -e staging"
    echo "  $0 -n somnia-mainnet -e production --no-verify"
    echo "  $0 -n local --deploy-test-token"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -n|--network)
            NETWORK="$2"
            shift 2
            ;;
        -e|--environment)
            ENVIRONMENT="$2"
            shift 2
            ;;
        -k|--private-key)
            PRIVATE_KEY="$2"
            shift 2
            ;;
        --no-verify)
            VERIFY_CONTRACTS="false"
            shift
            ;;
        --deploy-test-token)
            DEPLOY_TEST_TOKEN="true"
            shift
            ;;
        -h|--help)
            show_usage
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            show_usage
            exit 1
            ;;
    esac
done

# Validate network
if [[ -z "$NETWORK" ]]; then
    print_error "Network is required. Use -n or --network option."
    show_usage
    exit 1
fi

# Validate network options
case $NETWORK in
    somnia-testnet|somnia-mainnet|local)
        ;;
    *)
        print_error "Invalid network: $NETWORK"
        print_error "Supported networks: somnia-testnet, somnia-mainnet, local"
        exit 1
        ;;
esac

# Check if we're in the contracts directory
if [[ ! -f "foundry.toml" ]]; then
    print_error "Please run this script from the contracts directory"
    exit 1
fi

# Load environment variables
if [[ -f ".env" ]]; then
    print_status "Loading environment variables from .env"
    source .env
fi

# Set private key from environment if not provided
if [[ -z "$PRIVATE_KEY" && -n "$PRIVATE_KEY_ENV" ]]; then
    PRIVATE_KEY="$PRIVATE_KEY_ENV"
fi

if [[ -z "$PRIVATE_KEY" ]]; then
    print_warning "No private key provided. Using default test key for local development."
    PRIVATE_KEY="0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
fi

# Set network-specific RPC URLs
case $NETWORK in
    somnia-testnet)
        RPC_URL="${SOMNIA_TESTNET_RPC_URL:-https://dream-rpc.somnia.network}"
        CHAIN_ID="50311"
        ;;
    somnia-mainnet)
        RPC_URL="${SOMNIA_MAINNET_RPC_URL:-https://rpc.somnia.network}"
        CHAIN_ID="2648"
        ;;
    local)
        RPC_URL="http://localhost:8545"
        CHAIN_ID="31337"
        ;;
esac

print_status "Deployment Configuration:"
echo "  Network: $NETWORK"
echo "  Environment: $ENVIRONMENT"
echo "  RPC URL: $RPC_URL"
echo "  Chain ID: $CHAIN_ID"
echo "  Verify Contracts: $VERIFY_CONTRACTS"
echo "  Deploy Test Token: $DEPLOY_TEST_TOKEN"

# Create deployments directory
mkdir -p deployments

# Compile contracts
print_status "Compiling contracts..."
forge build

if [[ $? -ne 0 ]]; then
    print_error "Contract compilation failed"
    exit 1
fi

print_success "Contracts compiled successfully"

# Deploy contracts
print_status "Deploying contracts to $NETWORK..."

# Set environment variables for the deployment script
export PRIVATE_KEY="$PRIVATE_KEY"
export DEPLOY_VERIFY_CONTRACTS="$VERIFY_CONTRACTS"
export NETWORK_NAME="$NETWORK"

# Run deployment script
DEPLOYMENT_CMD="forge script script/DeployProduction.s.sol:DeployProduction --rpc-url $RPC_URL --private-key $PRIVATE_KEY"

if [[ "$NETWORK" != "local" ]]; then
    DEPLOYMENT_CMD="$DEPLOYMENT_CMD --broadcast"
fi

if [[ "$VERIFY_CONTRACTS" == "true" && "$NETWORK" != "local" ]]; then
    DEPLOYMENT_CMD="$DEPLOYMENT_CMD --verify"
fi

print_status "Running deployment command:"
echo "$DEPLOYMENT_CMD"

eval $DEPLOYMENT_CMD

if [[ $? -ne 0 ]]; then
    print_error "Deployment failed"
    exit 1
fi

print_success "Contracts deployed successfully"

# Deploy test token if requested
if [[ "$DEPLOY_TEST_TOKEN" == "true" ]]; then
    print_status "Deploying test token..."

    # Get factory address from deployment file
    DEPLOYMENT_FILE="deployments/$NETWORK-$CHAIN_ID.json"
    if [[ -f "$DEPLOYMENT_FILE" ]]; then
        FACTORY_ADDRESS=$(cat "$DEPLOYMENT_FILE" | grep -o '"TokenFactory": "[^"]*"' | cut -d'"' -f4)
        export TOKEN_FACTORY_ADDRESS="$FACTORY_ADDRESS"
        export TEST_TOKEN_NAME="Spawn Test Token"
        export TEST_TOKEN_SYMBOL="SPAWN"
        export TEST_TOKEN_DESCRIPTION="Test token for spawn.fun demonstration on $NETWORK"

        TEST_TOKEN_CMD="forge script script/DeployTestToken.s.sol:DeployTestToken --rpc-url $RPC_URL --private-key $PRIVATE_KEY"

        if [[ "$NETWORK" != "local" ]]; then
            TEST_TOKEN_CMD="$TEST_TOKEN_CMD --broadcast"
        fi

        eval $TEST_TOKEN_CMD

        if [[ $? -eq 0 ]]; then
            print_success "Test token deployed successfully"
        else
            print_warning "Test token deployment failed"
        fi
    else
        print_warning "Could not find deployment file to get factory address"
    fi
fi

# Generate summary
print_success "Deployment completed successfully!"
echo ""
echo "📋 Summary:"
echo "  Network: $NETWORK"
echo "  Environment: $ENVIRONMENT"
echo "  Deployment file: deployments/$NETWORK-$CHAIN_ID.json"

if [[ -f "deployments/$NETWORK-$CHAIN_ID.json" ]]; then
    echo ""
    echo "📜 Deployed Contracts:"
    cat "deployments/$NETWORK-$CHAIN_ID.json" | grep -E '"TokenFactory"|"LaunchToken"|"HyperBondingCurve"' | sed 's/^/  /'
fi

if [[ "$DEPLOY_TEST_TOKEN" == "true" && -f "deployments/test-token-$CHAIN_ID.json" ]]; then
    echo ""
    echo "🧪 Test Token:"
    cat "deployments/test-token-$CHAIN_ID.json" | grep -E '"address"|"bondingCurve"' | sed 's/^/  /'
fi

echo ""
print_success "Deployment script completed! 🚀"