# 🛠️ Development Setup Guide - react.fun

## 🎯 Quick Start for Testing

### Option 1: Local Development (Fastest - No Deployment Needed)

This lets you test the UI immediately with mock data:

```bash
# 1. Start frontend
cd /home/bprime/Hackathons/react.fun/frontend
npm run dev
```

Then open http://localhost:3000

**Note:** This uses mock data. Transactions won't actually execute.

---

### Option 2: Deploy to Testnets (Full Integration)

## 📍 Where to Get Test Tokens

### 1. **Ethereum Sepolia ETH**
- **Faucet 1**: https://sepoliafaucet.com/
- **Faucet 2**: https://www.alchemy.com/faucets/ethereum-sepolia
- **Faucet 3**: https://faucet.quicknode.com/ethereum/sepolia
- **Amount**: 0.5 ETH (enough for ~50 test launches)

### 2. **Polygon Amoy MATIC**
- **Faucet**: https://faucet.polygon.technology/
- **Select**: Polygon Amoy Testnet
- **Amount**: 1 MATIC

### 3. **BSC Testnet BNB**
- **Faucet**: https://testnet.bnbchain.org/faucet-smart
- **Amount**: 0.5 tBNB

### 4. **Arbitrum Sepolia ETH**
- **Faucet**: https://faucet.quicknode.com/arbitrum/sepolia
- **Alternative**: Bridge from Ethereum Sepolia

### 5. **Base Sepolia ETH**
- **Faucet**: https://www.alchemy.com/faucets/base-sepolia
- **Alternative**: https://docs.base.org/tools/network-faucets

### 6. **REACT Tokens (For RSCs)**
- **Method**: Send Sepolia ETH to Reactive faucet contract
- **Contract**: `0x9b9BB25f1A81078C544C829c5EB7822d747Cf434`
- **Conversion**: 1 SepETH = 100 REACT
- **How to**:
  ```bash
  # Send 5 SepETH to get 500 REACT (enough for all RSCs)
  cast send 0x9b9BB25f1A81078C544C829c5EB7822d747Cf434 \
    --value 5ether \
    --rpc-url https://ethereum-sepolia-rpc.publicnode.com \
    --private-key $PRIVATE_KEY
  ```

---

## 🚀 Deployment Steps

### Prerequisites

1. **Install Foundry** (if not already):
   ```bash
   curl -L https://foundry.paradigm.xyz | bash
   foundryup
   ```

2. **Set Private Key**:
   ```bash
   export PRIVATE_KEY="your-private-key-here"
   ```

3. **Get Test Tokens** (see above)

---

### Step 1: Deploy RSCs on Reactive Network

```bash
cd /home/bprime/Hackathons/react.fun/contracts

# Deploy to Reactive Mainnet
forge script script/DeployReactive.s.sol \
  --rpc-url https://mainnet-rpc.rnk.dev/ \
  --broadcast \
  --private-key $PRIVATE_KEY \
  --legacy

# Save the addresses that are output!
```

**Expected Output:**
```
CrossChainLaunchCoordinator: 0x...
UnifiedPriceOracle:          0x...
ArbitragePrevention:         0x...
LiquidityAggregator:         0x...
SecurityGuardian:            0x...
TreasuryManager:             0x...
```

---

### Step 2: Fund RSCs with REACT

```bash
# You should have ~500 REACT from the faucet
# Fund each RSC with ~80 REACT

cast send <LAUNCH_COORDINATOR_ADDRESS> \
  --value 80ether \
  --rpc-url https://mainnet-rpc.rnk.dev/ \
  --private-key $PRIVATE_KEY

# Repeat for all 6 RSCs
```

---

### Step 3: Deploy on Each Testnet

```bash
# Ethereum Sepolia
forge script script/DeployMultiChain.s.sol \
  --rpc-url https://ethereum-sepolia-rpc.publicnode.com \
  --broadcast \
  --private-key $PRIVATE_KEY \
  --legacy

# Polygon Amoy
forge script script/DeployMultiChain.s.sol \
  --rpc-url https://rpc-amoy.polygon.technology \
  --broadcast \
  --private-key $PRIVATE_KEY \
  --legacy

# BSC Testnet
forge script script/DeployMultiChain.s.sol \
  --rpc-url https://bsc-testnet-rpc.publicnode.com \
  --broadcast \
  --private-key $PRIVATE_KEY \
  --legacy

# Arbitrum Sepolia
forge script script/DeployMultiChain.s.sol \
  --rpc-url https://arbitrum-sepolia-rpc.publicnode.com \
  --broadcast \
  --private-key $PRIVATE_KEY \
  --legacy

# Base Sepolia
forge script script/DeployMultiChain.s.sol \
  --rpc-url https://base-sepolia-rpc.publicnode.com \
  --broadcast \
  --private-key $PRIVATE_KEY \
  --legacy
```

**Save all addresses from each deployment!**

---

### Step 4: Update Frontend Config

Edit `/home/bprime/Hackathons/react.fun/frontend/lib/reactive-config.ts`:

```typescript
export const RSC_ADDRESSES = {
  LAUNCH_COORDINATOR: '0xYOUR_ADDRESS_HERE',
  PRICE_ORACLE: '0xYOUR_ADDRESS_HERE',
  // ... etc
}

export const CONTRACT_ADDRESSES = {
  [11155111]: { // Ethereum Sepolia
    ORIGIN_FACTORY: '0xYOUR_ADDRESS_HERE',
    // ... etc
  },
  // ... repeat for all chains
}
```

---

### Step 5: Initialize RSCs

```bash
# Initialize CrossChainLaunchCoordinator
cast send $LAUNCH_COORDINATOR_ADDRESS \
  "initialize(address[],uint256[],address[])" \
  "[$FACTORY1,$FACTORY2,$FACTORY3]" \
  "[11155111,80002,97]" \
  "[$DEPLOYER1,$DEPLOYER2,$DEPLOYER3]" \
  --rpc-url https://mainnet-rpc.rnk.dev/ \
  --private-key $PRIVATE_KEY

# Similar for other RSCs...
```

---

### Step 6: Authorize ReactVMs

On each destination chain:

```bash
cast send $DESTINATION_DEPLOYER \
  "authorizeReactVM(address,bool)" \
  $LAUNCH_COORDINATOR_ADDRESS true \
  --rpc-url $CHAIN_RPC \
  --private-key $PRIVATE_KEY
```

---

## 🧪 Testing the Live App

### Start Frontend

```bash
cd /home/bprime/Hackathons/react.fun/frontend
npm install
npm run dev
```

Open http://localhost:3000

### Test Token Launch

1. **Connect Wallet** (MetaMask with Sepolia network)
2. **Click "Launch Token"**
3. **Fill in details**:
   - Name: "Test Pepe"
   - Symbol: "TPEPE"
   - Description: "Test meme coin"
   - Image URL: Any image URL
4. **Select Chains**: Choose 2-3 chains
5. **Pay Creation Fee**: 0.001 ETH per chain
6. **Wait**: RSCs will deploy to all chains (~30 seconds)

### Test Trading

1. **Find your token** on the token list
2. **Click "Trade"**
3. **Buy some tokens** (send 0.01 ETH)
4. **Check other chains**: Price should sync within seconds
5. **Sell tokens**: Verify price updates across chains

### Monitor RSC Activity

Check Reactive Network explorer:
- **Mainnet**: https://reactscan.net/
- **Testnet**: https://lasna.reactscan.net

Look for:
- LaunchRequest event detection
- Callback emissions
- REACT gas consumption

---

## 🐛 Troubleshooting

### "Insufficient funds" error
- Check you have test tokens on the current chain
- Switch networks in MetaMask

### "Transaction reverted"
- Contracts might not be initialized
- Check RSCs have REACT balance
- Verify ReactVM addresses are authorized

### "Chain not supported"
- Make sure you're on a testnet (not mainnet)
- Check chain IDs match configuration

### RSCs not responding
- Check REACT balance: `cast balance $RSC_ADDRESS --rpc-url https://mainnet-rpc.rnk.dev/`
- Verify subscriptions are set up
- Check event logs on origin chains

---

## 📊 Quick Test Checklist

- [ ] Get test tokens from all 6 faucets
- [ ] Deploy 6 RSCs to Reactive Mainnet
- [ ] Fund RSCs with REACT
- [ ] Deploy contracts to 5 testnets
- [ ] Update frontend config with addresses
- [ ] Initialize all RSCs
- [ ] Authorize ReactVMs on all chains
- [ ] Start frontend dev server
- [ ] Launch a test token on 3 chains
- [ ] Trade and verify price sync
- [ ] Check migration at $69K threshold

---

## 🎥 Demo Recording Tips

1. **Screen record** the entire flow
2. **Show wallet transactions** confirming
3. **Switch between chains** to show multi-chain deployment
4. **Open block explorers** to show RSC callbacks
5. **Monitor ReactScan** for REACT burns
6. **Time the video** - keep under 5 minutes

---

## 💡 Mock Mode (No Deployment)

To test UI without deployment:

```bash
cd frontend
npm run dev
```

The app will use mock data and simulated blockchain interactions. Perfect for:
- UI/UX testing
- Component development
- Demo screenshots
- Video recording (if deployment isn't ready)

---

## 🔗 Useful Links

- **Reactive Network Docs**: https://dev.reactive.network/
- **Foundry Book**: https://book.getfoundry.sh/
- **Sepolia Explorer**: https://sepolia.etherscan.io/
- **Polygon Amoy Explorer**: https://amoy.polygonscan.com/
- **BSC Testnet Explorer**: https://testnet.bscscan.com/
- **ReactScan**: https://reactscan.net/

---

**Ready to revolutionize multi-chain token launches!** 🚀
