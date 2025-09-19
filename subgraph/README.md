# Spawn.fun Subgraph

This subgraph indexes Spawn.fun platform events on the Somnia Network, providing real-time data for tokens, trading activity, and platform analytics.

## Features

- **Token Tracking**: Complete token lifecycle from creation to migration
- **Trading Analytics**: Real-time price feeds, volume, and trade history
- **User Statistics**: Creator and trader activity tracking
- **Platform Metrics**: Daily/weekly platform-wide statistics
- **Price History**: OHLC data for charting at multiple intervals
- **Bonding Curve Metrics**: Progress tracking and migration monitoring

## Entities

### Core Entities

- **TokenFactory**: Platform factory contract tracking
- **Token**: Individual token information and metadata
- **BondingCurve**: Bonding curve parameters and state
- **Trade**: Individual buy/sell transactions
- **TokenHolder**: User token balances and trading history

### Analytics Entities

- **PricePoint**: OHLC price data for charts (1min, 5min, 15min, 1h, 4h, 1d)
- **DailyStats**: Daily platform statistics
- **UserStats**: Per-user activity summaries
- **PlatformStats**: Global platform metrics
- **CurveMigration**: DEX migration events

## Setup

### Prerequisites

- Node.js 16+
- The Graph CLI: `npm install -g @graphprotocol/graph-cli`
- Contracts deployed and built

### Installation

```bash
# Install dependencies
npm install

# Prepare contract ABIs
./scripts/prepare-abis.sh

# Generate code
npm run codegen

# Build subgraph
npm run build
```

### Network Configuration

Configure network-specific settings in `config/`:

- `testnet.json` - Somnia testnet configuration
- `mainnet.json` - Somnia mainnet configuration
- `local.json` - Local development configuration

Update the contract addresses and start blocks after deployment.

### Deployment

#### Local Development

```bash
# Start local Graph node (requires Docker)
git clone https://github.com/graphprotocol/graph-node/
cd graph-node/docker
docker-compose up

# Prepare and deploy to local node
npm run prepare:local
npm run create:local
npm run deploy:local
```

#### Testnet

```bash
# Update config/testnet.json with deployed contract addresses
npm run prepare:testnet
npm run deploy:testnet
```

#### Mainnet

```bash
# Update config/mainnet.json with deployed contract addresses
npm run prepare:mainnet
npm run deploy:mainnet
```

## GraphQL Schema

The subgraph exposes a GraphQL API with the following main queries:

### Tokens

```graphql
query GetTokens($first: Int!, $skip: Int!) {
  tokens(first: $first, skip: $skip, orderBy: createdAt, orderDirection: desc) {
    id
    name
    symbol
    description
    imageUrl
    creator
    totalSupply
    currentPrice
    marketCap
    totalTrades
    totalVolume
    migrated
    bondingCurve {
      id
      progress
      virtualETH
      virtualTokens
    }
  }
}
```

### Trades

```graphql
query GetTrades($token: Bytes!, $first: Int!) {
  trades(
    where: { token: $token }
    first: $first
    orderBy: timestamp
    orderDirection: desc
  ) {
    id
    trader
    type
    ethAmount
    tokenAmount
    price
    timestamp
  }
}
```

### Price History

```graphql
query GetPriceHistory($token: Bytes!, $interval: PriceInterval!) {
  pricePoints(
    where: { token: $token, interval: $interval }
    orderBy: timestamp
    orderDirection: asc
  ) {
    timestamp
    open
    high
    low
    close
    volume
  }
}
```

### Platform Statistics

```graphql
query GetPlatformStats {
  platformStats(id: "platform") {
    totalTokens
    totalTrades
    totalVolume
    totalFees
    activeTokens
    totalMigrations
  }
}
```

## Event Handlers

### TokenFactory Events

- **TokenCreated**: Creates Token and BondingCurve entities
- **TokenMetadata**: Updates token description and image
- **FeesWithdrawn**: Tracks platform fee collection

### BondingCurve Events

- **TokenPurchase**: Records buy transactions and updates metrics
- **TokenSale**: Records sell transactions and updates metrics
- **CurveMigration**: Handles DEX migration completion
- **EmergencyPause/Unpause**: Updates curve state

### LaunchToken Events

- **Transfer**: Tracks token transfers and holder balances

## Data Updates

The subgraph provides real-time updates for:

- Token prices and market caps
- Trading volume and transaction counts
- User balances and portfolio values
- Platform-wide statistics
- Bonding curve progress and migration status

## Monitoring

Monitor subgraph health and sync status:

```bash
# Check sync status
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"query": "{ _meta { block { number } } }"}' \
  https://api.thegraph.com/subgraphs/name/spawn-fun/spawn-testnet
```

## Development

### Adding New Entities

1. Update `schema.graphql` with new entity definitions
2. Run `npm run codegen` to generate TypeScript types
3. Implement event handlers in appropriate mapping files
4. Test with local deployment

### Testing

```bash
# Run unit tests
npm run test

# Test specific handler
graph test TokenFactory.test.ts
```

## Architecture

```
subgraph/
├── schema.graphql           # GraphQL schema definition
├── subgraph.yaml           # Main subgraph configuration
├── subgraph.template.yaml  # Template for network configs
├── package.json
├── config/                 # Network-specific configurations
│   ├── testnet.json
│   ├── mainnet.json
│   └── local.json
├── src/                    # Event handlers
│   ├── token-factory.ts
│   ├── bonding-curve.ts
│   └── launch-token.ts
├── abis/                   # Contract ABIs
├── scripts/
│   └── prepare-abis.sh
└── generated/              # Generated code (created by codegen)
```

## Performance Considerations

- Price points are aggregated at multiple intervals to support different chart timeframes
- User statistics are updated incrementally to avoid expensive recalculations
- Platform statistics use singleton pattern for efficient global metrics
- Event handlers include gas-efficient filtering and early returns

## Contributing

1. Follow AssemblyScript conventions for mapping functions
2. Add proper error handling for edge cases
3. Update schema documentation for new entities
4. Test with realistic data scenarios
5. Ensure compatibility with The Graph's indexing requirements

## License

MIT License - see LICENSE file for details.