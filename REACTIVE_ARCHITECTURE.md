# 🔄 react.fun - Reactive Architecture Documentation

## 🎯 Overview

**react.fun** is the world's first true multi-chain token launchpad powered by Reactive Smart Contracts (RSCs). Users can launch tokens **once** and have them instantly tradeable on multiple chains with **unified pricing** maintained autonomously by Reactive Network.

## 🏗️ Architecture

### Three-Layer System

```
┌──────────────────────────────────────────────────────────┐
│         LAYER 1: ORIGIN CONTRACTS (Multi-Chain)          │
│  Ethereum, Polygon, BSC, Arbitrum, Base                  │
│                                                           │
│  • OriginTokenFactory   - Emits LaunchRequest events     │
│  • OriginBondingCurve   - Emits Trade/Price events       │
│  • OriginLaunchToken    - Standard ERC20 with metadata   │
└──────────────────────┬───────────────────────────────────┘
                       │
                       │ Events ↓
                       │
┌──────────────────────▼───────────────────────────────────┐
│      LAYER 2: REACTIVE SMART CONTRACTS (Reactive Network) │
│  Chain ID: 1597 (Mainnet) / 5318007 (Testnet)           │
│                                                           │
│  1. CrossChainLaunchCoordinator - Multi-chain deployment │
│  2. UnifiedPriceOracle          - Price synchronization  │
│  3. ArbitragePrevention         - Price parity           │
│  4. LiquidityAggregator         - Migration coordination │
│  5. SecurityGuardian            - Threat detection       │
│  6. TreasuryManager             - Fee aggregation        │
└──────────────────────┬───────────────────────────────────┘
                       │
                       │ Callbacks ↓
                       │
┌──────────────────────▼───────────────────────────────────┐
│       LAYER 3: DESTINATION CONTRACTS (Multi-Chain)        │
│  Same chains as Origin Layer                             │
│                                                           │
│  • DestinationDeployer  - Deploys tokens from callbacks  │
│  • DestinationPriceSync - Updates prices from RSCs       │
│  • DestinationMigrator  - Executes DEX migrations        │
└──────────────────────────────────────────────────────────┘
```

## 📊 End-to-End Workflow

### 1. Token Launch

**User Action:**
```javascript
// User launches token on Ethereum selecting [Ethereum, Polygon, BSC]
factory.createMultiChainToken(
  "PepeCoin",
  "PEPE",
  "Best meme coin",
  "ipfs://...",
  [11155111, 80002, 97] // Ethereum, Polygon, BSC
)
```

**What Happens:**

1. **OriginTokenFactory** deploys token + bonding curve on Ethereum
2. **Emits `LaunchRequest` event**:
   ```solidity
   event LaunchRequest(
     address creator,
     address originToken,
     address bondingCurve,
     string name,
     string symbol,
     string description,
     string imageUrl,
     uint256[] targetChains,
     uint256 timestamp,
     uint256 originChainId
   )
   ```

3. **CrossChainLaunchCoordinator RSC** detects event:
   - Subscribes to LaunchRequest on all origin chains
   - Receives event in `react()` function
   - Stores launch metadata

4. **RSC emits callbacks** to deploy on Polygon + BSC:
   ```solidity
   emit Callback(
     chainId,           // Polygon/BSC
     destinationDeployer,
     gasLimit,
     payload            // deployToken() call data
   )
   ```

5. **DestinationDeployer** receives callbacks:
   - Deploys token + curve on Polygon
   - Deploys token + curve on BSC
   - Emits `TokenDeployed` events

**Result:** Token is now live on 3 chains with identical bonding curves!

---

### 2. Trading & Price Synchronization

**User Action:**
```javascript
// Alice buys $100 worth of PEPE on Ethereum
bondingCurve.buy({value: ethers.utils.parseEther("0.1")})
```

**What Happens:**

1. **OriginBondingCurve** on Ethereum:
   - Calculates tokens out using Bancor formula
   - Updates curve state
   - **Emits `TokenPurchase` event**:
     ```solidity
     event TokenPurchase(
       address buyer,
       uint256 ethIn,
       uint256 tokensOut,
       uint256 newPrice,
       uint256 chainId
     )
     ```

2. **UnifiedPriceOracle RSC** detects trade:
   - Receives event from Ethereum chain
   - Updates price tracking:
     ```solidity
     chainPrices[token][ETHEREUM] = newPrice;
     ```
   - Calculates volume-weighted average price across all chains:
     ```solidity
     unifiedPrice = (ethPrice * ethVolume + polyPrice * polyVolume + bscPrice * bscVolume)
                    / (ethVolume + polyVolume + bscVolume)
     ```

3. **RSC checks price deviation**:
   - Compares Polygon/BSC prices to unified price
   - If deviation > 0.5%, emits sync callbacks:
     ```solidity
     emit Callback(
       POLYGON,
       destinationPriceSync,
       gasLimit,
       abi.encodeWithSignature(
         "syncPrice(address,address,uint256,uint256)",
         reactVM, token, unifiedPrice, totalSupply
       )
     )
     ```

4. **DestinationPriceSync** on Polygon/BSC:
   - Receives callback
   - Updates bonding curve price
   - Maintains price parity across chains

**Result:** Price is synchronized across all chains within seconds!

---

### 3. Arbitrage Prevention

**Scenario:** Price discrepancy detected

**What Happens:**

1. **ArbitragePrevention RSC** monitors all chain prices:
   - Subscribes to `PriceUpdate` events
   - Calculates price deltas:
     ```solidity
     deviation = |ethPrice - polyPrice| / ethPrice * 10000 // in basis points
     ```

2. **If deviation > 50 basis points (0.5%)**:
   - Emits `PriceDiscrepancyDetected` event
   - Could trigger rebalancing trades (not implemented in demo):
     - Buy on cheaper chain
     - Sell on expensive chain
     - Restore parity

**Result:** Price arbitrage opportunities are minimized!

---

### 4. Migration to DEX

**Trigger:** Combined market cap reaches $69,000

**What Happens:**

1. **OriginBondingCurve** on any chain:
   - Checks if `getMarketCap() >= $69K`
   - **Emits `MigrationThresholdReached` event**:
     ```solidity
     event MigrationThresholdReached(
       address token,
       uint256 totalMarketCap,
       uint256[] chainIds
     )
     ```

2. **LiquidityAggregator RSC** detects threshold:
   - Aggregates market caps from all chains:
     ```solidity
     totalMarketCap = chainMarketCaps[token][ETHEREUM]
                    + chainMarketCaps[token][POLYGON]
                    + chainMarketCaps[token][BSC]
     ```
   - Confirms threshold is met globally

3. **RSC triggers coordinated migration**:
   - Emits migration callbacks to **all 3 chains simultaneously**:
     ```solidity
     for (each chain) {
       emit Callback(
         chainId,
         destinationMigrator,
         gasLimit,
         abi.encodeWithSignature("migrateToDEX(address,address)", reactVM, token)
       )
     }
     ```

4. **DestinationMigrator** on each chain:
   - Creates DEX pair (Uniswap/PancakeSwap/QuickSwap)
   - Adds liquidity from bonding curve
   - Locks/burns curve LP tokens
   - Emits `MigrationCompleted` event

**Result:** Token graduates to DEX on all chains at the same time!

---

### 5. Security Monitoring

**Continuous Operation:**

**SecurityGuardian RSC** monitors all trading activity:

1. **Detects suspicious patterns**:
   - Trades > 10 ETH
   - > 20 trades per minute
   - Unusual wallet behaviors

2. **Emits alerts**:
   ```solidity
   emit SuspiciousActivityDetected(
     token,
     chainId,
     "Large trade detected",
     severity: 2,
     timestamp
   )
   ```

3. **Can trigger emergency pause** (if configured):
   - Emits pause callbacks to all chains
   - Halts trading across entire ecosystem

**Result:** Proactive security monitoring across all chains!

---

### 6. Treasury Management

**Continuous Operation:**

**TreasuryManager RSC** aggregates fees:

1. **Monitors `FeesCollected` events** from all chains:
   ```solidity
   event FeesCollected(
     address token,
     uint256 chainId,
     uint256 platformFees,
     uint256 creatorFees
   )
   ```

2. **Aggregates totals**:
   ```solidity
   totalPlatformFees[token] += fees from all chains
   totalCreatorFees[token] += fees from all chains
   ```

3. **Could trigger distributions** (not implemented in demo):
   - Route fees to cheapest chain for withdrawal
   - Automatically distribute to creators
   - Optimize gas costs

**Result:** Efficient cross-chain treasury management!

---

## 💰 REACT Gas Consumption

### Per Token Launch (3 chains):
- **LaunchRequest detection**: 1 RSC activation
- **Deployment callbacks**: 3 callbacks = **3x REACT burn**
- **Initial price sync**: 3 callbacks = **3x REACT burn**
- **Total**: ~6-10 REACT per launch

### Per Trade:
- **Trade event processing**: 1 RSC activation
- **Price sync callbacks**: 2 callbacks (to other chains) = **2x REACT burn**
- **Arbitrage check**: 1 RSC activation
- **Security scan**: 1 RSC activation
- **Fee aggregation**: 1 RSC activation
- **Total**: ~4-6 REACT per trade

### Per Migration:
- **Threshold detection**: 1 RSC activation
- **Multi-chain coordination**: 3 callbacks = **3x REACT burn**
- **Total**: ~3-5 REACT per migration

### Daily Estimate (Conservative):
- **20 launches/day**: 20 × 10 = **200 REACT**
- **500 trades/day**: 500 × 5 = **2,500 REACT**
- **2 migrations/day**: 2 × 5 = **10 REACT**
- **Total: ~2,710 REACT/day**

At scale (100 launches, 5K trades):
- **~27,000 REACT/day burned** 🔥

---

## 🔑 Key Innovations

### 1. **Impossible Without RSCs**

**Problem:** Traditional approaches require:
- ❌ Centralized relayers watching multiple chains
- ❌ Trust in oracle operators
- ❌ High operational costs
- ❌ 5-15 minute delays
- ❌ Bridge fees for every action

**Solution:** RSCs enable:
- ✅ Autonomous monitoring of all chains simultaneously
- ✅ Real-time cross-chain coordination (sub-second)
- ✅ Fully trustless and decentralized
- ✅ Only pay gas as needed
- ✅ **Literally impossible to build securely without RSCs**

### 2. **Unified Bonding Curve**

All chains maintain the same bonding curve parameters:
- 800M tokens on curve
- $69K migration threshold
- Identical pricing formula

Prices stay synchronized through RSC-powered oracle.

### 3. **Coordinated Multi-Chain Operations**

RSCs orchestrate complex multi-chain operations:
- Simultaneous deployment
- Synchronized price updates
- Coordinated DEX migrations
- Global security monitoring

### 4. **Self-Perpetuating System**

Once deployed, the system runs indefinitely:
- RSCs monitor events 24/7
- Callbacks execute automatically
- No manual intervention needed
- Just keep RSCs funded with REACT

---

## 📈 Comparison

| Feature | Traditional Multi-Chain | react.fun (RSC-Powered) |
|---------|------------------------|------------------------|
| Deployment | Deploy separately on each chain | Deploy once, replicate everywhere |
| Pricing | Fragmented, inconsistent | Unified, synchronized |
| Latency | 5-15 minutes | Sub-second |
| Trust | Requires relayers/oracles | Fully trustless |
| Costs | Bridge fees + gas | Only gas (no bridges) |
| Maintenance | Manual monitoring | Autonomous |
| Security | Per-chain | Global coordination |
| Migration | Manual per chain | Coordinated across all |

---

## 🚀 Production Enhancements

### For Mainnet Deployment:

1. **DEX Integration:**
   - Implement actual Uniswap V2/V3 integration
   - Add liquidity functions
   - LP token management

2. **Enhanced Arbitrage Prevention:**
   - Implement actual rebalancing trades
   - Multi-hop routing optimization
   - MEV protection

3. **Advanced Security:**
   - ML-based anomaly detection
   - Automated emergency pause
   - Governance integration

4. **Fee Optimization:**
   - Cross-chain fee routing
   - Automated distributions
   - Gas optimization

5. **Frontend:**
   - Real-time multi-chain price display
   - Unified trading interface
   - Cross-chain portfolio tracking
   - Analytics dashboard

---

## 📝 Contract Addresses

### Reactive Network (Mainnet: 1597)
- **CrossChainLaunchCoordinator**: `<DEPLOY_ADDRESS>`
- **UnifiedPriceOracle**: `<DEPLOY_ADDRESS>`
- **ArbitragePrevention**: `<DEPLOY_ADDRESS>`
- **LiquidityAggregator**: `<DEPLOY_ADDRESS>`
- **SecurityGuardian**: `<DEPLOY_ADDRESS>`
- **TreasuryManager**: `<DEPLOY_ADDRESS>`

### Ethereum Sepolia (11155111)
- **OriginTokenFactory**: `<DEPLOY_ADDRESS>`
- **DestinationDeployer**: `<DEPLOY_ADDRESS>`
- **DestinationPriceSync**: `<DEPLOY_ADDRESS>`
- **DestinationMigrator**: `<DEPLOY_ADDRESS>`

*[Repeat for Polygon, BSC, Arbitrum, Base]*

---

## 🎓 Learn More

- **Reactive Network Docs**: https://dev.reactive.network/
- **RSC Examples**: https://github.com/Reactive-Network/reactive-smart-contract-demos
- **react.fun Demo**: Coming soon

---

**Built with ❤️ on Reactive Network**
