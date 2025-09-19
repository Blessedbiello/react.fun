#!/bin/bash

# Spawn.fun Development Startup Script
# This script starts all necessary services for local development

set -e

echo "🚀 Starting Spawn.fun Development Environment"
echo "=============================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Check if required tools are installed
check_dependencies() {
    print_info "Checking dependencies..."

    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed. Please install Node.js 18+"
        exit 1
    fi

    if ! command -v npm &> /dev/null; then
        print_error "npm is not installed. Please install npm"
        exit 1
    fi

    if ! command -v forge &> /dev/null; then
        print_error "Foundry is not installed. Please install Foundry"
        exit 1
    fi

    print_status "All dependencies are installed"
}

# Function to kill background processes on exit
cleanup() {
    print_info "Cleaning up background processes..."
    if [[ -n $ANVIL_PID ]]; then
        kill $ANVIL_PID 2>/dev/null || true
    fi
    if [[ -n $FRONTEND_PID ]]; then
        kill $FRONTEND_PID 2>/dev/null || true
    fi
    if [[ -n $SUBGRAPH_PID ]]; then
        kill $SUBGRAPH_PID 2>/dev/null || true
    fi
    print_status "Cleanup complete"
}

# Set trap to cleanup on exit
trap cleanup EXIT

# Start local blockchain (Anvil)
start_blockchain() {
    print_info "Starting local blockchain (Anvil)..."
    cd contracts

    # Kill any existing anvil process
    pkill -f anvil || true
    sleep 2

    # Start anvil in background
    anvil --port 8545 --host 0.0.0.0 --accounts 10 --balance 10000 &
    ANVIL_PID=$!

    # Wait for anvil to start
    sleep 5

    # Check if anvil is running
    if curl -s -X POST -H "Content-Type: application/json" \
        --data '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}' \
        http://localhost:8545 > /dev/null; then
        print_status "Local blockchain started on http://localhost:8545"
    else
        print_error "Failed to start local blockchain"
        exit 1
    fi

    cd ..
}

# Deploy contracts
deploy_contracts() {
    print_info "Installing contract dependencies..."
    cd contracts
    forge install --root . || true

    print_info "Deploying contracts to local network..."

    # Deploy contracts
    if ./deploy.sh -n local --no-verify; then
        print_status "Contracts deployed successfully"

        # Update frontend environment with deployed addresses
        if [[ -f "deployments/localhost-31337.json" ]]; then
            FACTORY_ADDRESS=$(jq -r '.TokenFactory' deployments/localhost-31337.json)
            BONDING_CURVE_IMPL=$(jq -r '.ProductionHyperBondingCurve // .HyperBondingCurve' deployments/localhost-31337.json)
            TOKEN_IMPL=$(jq -r '.LaunchToken' deployments/localhost-31337.json)

            print_info "Updating frontend environment with contract addresses..."

            # Update .env.local with deployed addresses
            cd ../frontend
            sed -i "s/NEXT_PUBLIC_FACTORY_ADDRESS=.*/NEXT_PUBLIC_FACTORY_ADDRESS=$FACTORY_ADDRESS/" .env.local
            sed -i "s/NEXT_PUBLIC_BONDING_CURVE_IMPLEMENTATION=.*/NEXT_PUBLIC_BONDING_CURVE_IMPLEMENTATION=$BONDING_CURVE_IMPL/" .env.local
            sed -i "s/NEXT_PUBLIC_TOKEN_IMPLEMENTATION=.*/NEXT_PUBLIC_TOKEN_IMPLEMENTATION=$TOKEN_IMPL/" .env.local

            print_status "Frontend environment updated with contract addresses"
            cd ..
        else
            print_warning "Deployment file not found, using default addresses"
        fi
    else
        print_error "Contract deployment failed"
        exit 1
    fi

    cd ..
}

# Install frontend dependencies
install_frontend_deps() {
    print_info "Installing frontend dependencies..."
    cd frontend

    if npm install; then
        print_status "Frontend dependencies installed"
    else
        print_error "Failed to install frontend dependencies"
        exit 1
    fi

    cd ..
}

# Start frontend development server
start_frontend() {
    print_info "Starting frontend development server..."
    cd frontend

    # Start frontend in background
    npm run dev &
    FRONTEND_PID=$!

    # Wait for frontend to start
    sleep 10

    # Check if frontend is running
    if curl -s http://localhost:3000 > /dev/null; then
        print_status "Frontend started on http://localhost:3000"
    else
        print_warning "Frontend may still be starting up..."
    fi

    cd ..
}

# Start subgraph (optional)
start_subgraph() {
    if [[ -d "subgraph" ]]; then
        print_info "Setting up subgraph..."
        cd subgraph

        # Install dependencies
        npm install || true

        # Prepare ABIs
        if [[ -f "scripts/prepare-abis.sh" ]]; then
            ./scripts/prepare-abis.sh || print_warning "ABI preparation failed"
        fi

        # Generate code
        npm run codegen || print_warning "Subgraph codegen failed"

        # Build
        npm run build || print_warning "Subgraph build failed"

        print_status "Subgraph setup complete"
        cd ..
    else
        print_warning "Subgraph directory not found, skipping"
    fi
}

# Display startup information
show_startup_info() {
    echo ""
    echo "🎉 Spawn.fun Development Environment Started!"
    echo "=============================================="
    echo ""
    echo -e "${GREEN}🌐 Frontend:${NC}          http://localhost:3000"
    echo -e "${GREEN}⛓️  Local Blockchain:${NC}  http://localhost:8545"
    echo -e "${GREEN}📱 Chain ID:${NC}          31337 (Hardhat/Anvil)"
    echo ""
    echo -e "${BLUE}📋 Test Accounts:${NC}"
    echo "   Account #0: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
    echo "   Private Key: 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
    echo ""
    echo -e "${BLUE}🔗 Contract Addresses:${NC}"
    if [[ -f "contracts/deployments/localhost-31337.json" ]]; then
        echo "   TokenFactory:     $(jq -r '.TokenFactory' contracts/deployments/localhost-31337.json)"
        echo "   BondingCurve:     $(jq -r '.ProductionHyperBondingCurve // .HyperBondingCurve' contracts/deployments/localhost-31337.json)"
        echo "   LaunchToken:      $(jq -r '.LaunchToken' contracts/deployments/localhost-31337.json)"
    else
        echo "   Check contracts/deployments/ for deployed addresses"
    fi
    echo ""
    echo -e "${YELLOW}📖 Quick Start:${NC}"
    echo "   1. Open http://localhost:3000 in your browser"
    echo "   2. Connect MetaMask to localhost:8545"
    echo "   3. Import the test account using the private key above"
    echo "   4. Create your first token!"
    echo ""
    echo -e "${YELLOW}🛑 To stop all services:${NC} Press Ctrl+C"
    echo ""
}

# Parse command line arguments
SKIP_CONTRACTS=false
SKIP_FRONTEND=false
SKIP_SUBGRAPH=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --skip-contracts)
            SKIP_CONTRACTS=true
            shift
            ;;
        --skip-frontend)
            SKIP_FRONTEND=true
            shift
            ;;
        --skip-subgraph)
            SKIP_SUBGRAPH=true
            shift
            ;;
        --help)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --skip-contracts    Skip contract deployment"
            echo "  --skip-frontend     Skip frontend startup"
            echo "  --skip-subgraph     Skip subgraph setup"
            echo "  --help             Show this help message"
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Main execution flow
main() {
    check_dependencies

    if [[ "$SKIP_CONTRACTS" == "false" ]]; then
        start_blockchain
        deploy_contracts
    else
        print_warning "Skipping contract deployment"
    fi

    if [[ "$SKIP_FRONTEND" == "false" ]]; then
        install_frontend_deps
        start_frontend
    else
        print_warning "Skipping frontend startup"
    fi

    if [[ "$SKIP_SUBGRAPH" == "false" ]]; then
        start_subgraph
    else
        print_warning "Skipping subgraph setup"
    fi

    show_startup_info

    # Keep script running
    print_info "All services are running. Press Ctrl+C to stop."
    wait
}

# Run main function
main