#!/bin/bash

# Script to copy contract ABIs from contracts build output to subgraph directory
# Run this after building the contracts

set -e

echo "🔧 Preparing ABIs for subgraph..."

# Source and destination directories
CONTRACTS_DIR="../contracts"
ABIS_SOURCE_DIR="$CONTRACTS_DIR/out"
ABIS_DEST_DIR="./abis"

# Check if contracts are built
if [ ! -d "$ABIS_SOURCE_DIR" ]; then
    echo "❌ Contract build output not found. Please run 'forge build' in the contracts directory first."
    exit 1
fi

# Create destination directory
mkdir -p "$ABIS_DEST_DIR"

# Copy ABIs
echo "📋 Copying TokenFactory ABI..."
jq '.abi' "$ABIS_SOURCE_DIR/TokenFactory.sol/TokenFactory.json" > "$ABIS_DEST_DIR/TokenFactory.json"

echo "📋 Copying LaunchToken ABI..."
jq '.abi' "$ABIS_SOURCE_DIR/LaunchToken.sol/LaunchToken.json" > "$ABIS_DEST_DIR/LaunchToken.json"

echo "📋 Copying HyperBondingCurve ABI..."
if [ -f "$ABIS_SOURCE_DIR/ProductionHyperBondingCurve.sol/ProductionHyperBondingCurve.json" ]; then
    jq '.abi' "$ABIS_SOURCE_DIR/ProductionHyperBondingCurve.sol/ProductionHyperBondingCurve.json" > "$ABIS_DEST_DIR/HyperBondingCurve.json"
elif [ -f "$ABIS_SOURCE_DIR/HyperBondingCurve.sol/HyperBondingCurve.json" ]; then
    jq '.abi' "$ABIS_SOURCE_DIR/HyperBondingCurve.sol/HyperBondingCurve.json" > "$ABIS_DEST_DIR/HyperBondingCurve.json"
else
    echo "❌ HyperBondingCurve ABI not found"
    exit 1
fi

echo "✅ ABIs prepared successfully!"
echo "📁 ABIs copied to: $ABIS_DEST_DIR"

# Verify ABIs
echo ""
echo "🔍 Verifying ABIs..."
for abi_file in "$ABIS_DEST_DIR"/*.json; do
    if [ -f "$abi_file" ]; then
        echo "  ✅ $(basename "$abi_file")"
    else
        echo "  ❌ $(basename "$abi_file") - missing"
    fi
done

echo ""
echo "🎉 ABIs preparation complete!"