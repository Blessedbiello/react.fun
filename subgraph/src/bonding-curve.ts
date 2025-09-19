import { BigInt, Address, Bytes } from "@graphprotocol/graph-ts"
import {
  TokenPurchase,
  TokenSale,
  CurveMigration,
  EmergencyPause,
  EmergencyUnpause,
  NetworkConfigUpdated
} from "../../generated/templates/HyperBondingCurve/HyperBondingCurve"
import {
  BondingCurve,
  Token,
  Trade,
  TokenHolder,
  PricePoint,
  CurveMigration as CurveMigrationEntity,
  DailyStats,
  UserStats,
  PlatformStats,
  NetworkConfig
} from "../../generated/schema"

// Handle TokenPurchase event
export function handleTokenPurchase(event: TokenPurchase): void {
  let bondingCurve = BondingCurve.load(event.address)
  if (bondingCurve == null) {
    return
  }

  let token = Token.load(bondingCurve.token)
  if (token == null) {
    return
  }

  // Create Trade entity
  let tradeId = event.transaction.hash.concatI32(event.logIndex.toI32())
  let trade = new Trade(tradeId)
  trade.token = token.id
  trade.bondingCurve = bondingCurve.id
  trade.trader = event.params.buyer
  trade.type = "BUY"
  trade.ethAmount = event.params.ethAmount
  trade.tokenAmount = event.params.tokenAmount
  trade.price = event.params.price
  trade.platformFee = calculatePlatformFee(event.params.ethAmount)
  trade.creatorFee = calculateCreatorFee(event.params.ethAmount)
  trade.block = event.block.number
  trade.timestamp = event.block.timestamp
  trade.transactionHash = event.transaction.hash

  // Market data before trade
  trade.marketCapBefore = token.marketCap
  trade.totalSupplyBefore = token.totalSupply

  // Update bonding curve
  bondingCurve.totalTrades = bondingCurve.totalTrades.plus(BigInt.fromI32(1))
  bondingCurve.totalVolume = bondingCurve.totalVolume.plus(event.params.ethAmount)
  bondingCurve.totalFees = bondingCurve.totalFees.plus(trade.platformFee.plus(trade.creatorFee || BigInt.fromI32(0)))
  bondingCurve.totalSupply = bondingCurve.totalSupply.plus(event.params.tokenAmount)
  bondingCurve.progress = calculateProgress(bondingCurve.totalSupply)
  bondingCurve.updatedAt = event.block.timestamp
  bondingCurve.save()

  // Update token
  token.totalTrades = token.totalTrades.plus(BigInt.fromI32(1))
  token.totalVolume = token.totalVolume.plus(event.params.ethAmount)
  token.currentPrice = event.params.price
  token.totalSupply = token.totalSupply.plus(event.params.tokenAmount)
  token.marketCap = calculateMarketCap(token.totalSupply, event.params.price)

  // Market data after trade
  trade.marketCapAfter = token.marketCap
  trade.totalSupplyAfter = token.totalSupply
  trade.save()

  token.save()

  // Update token holder
  updateTokenHolder(token.id, event.params.buyer, event.params.tokenAmount, true, event.params.price, event.block.timestamp)

  // Update price point for charts
  updatePricePoint(token.id, event.params.price, event.params.ethAmount, event.block.timestamp)

  // Update statistics
  updateUserStats(event.params.buyer, event.block.timestamp, false, true, event.params.ethAmount, trade.platformFee.plus(trade.creatorFee || BigInt.fromI32(0)))
  updateDailyStats(event.block.timestamp, false, false, event.params.ethAmount, trade.platformFee.plus(trade.creatorFee || BigInt.fromI32(0)))
  updatePlatformStats(event.block.timestamp, false, false, event.params.ethAmount, trade.platformFee.plus(trade.creatorFee || BigInt.fromI32(0)))
}

// Handle TokenSale event
export function handleTokenSale(event: TokenSale): void {
  let bondingCurve = BondingCurve.load(event.address)
  if (bondingCurve == null) {
    return
  }

  let token = Token.load(bondingCurve.token)
  if (token == null) {
    return
  }

  // Create Trade entity
  let tradeId = event.transaction.hash.concatI32(event.logIndex.toI32())
  let trade = new Trade(tradeId)
  trade.token = token.id
  trade.bondingCurve = bondingCurve.id
  trade.trader = event.params.seller
  trade.type = "SELL"
  trade.ethAmount = event.params.ethAmount
  trade.tokenAmount = event.params.tokenAmount
  trade.price = event.params.price
  trade.platformFee = calculatePlatformFee(event.params.ethAmount)
  trade.creatorFee = null // No creator fee on sells
  trade.block = event.block.number
  trade.timestamp = event.block.timestamp
  trade.transactionHash = event.transaction.hash

  // Market data before trade
  trade.marketCapBefore = token.marketCap
  trade.totalSupplyBefore = token.totalSupply

  // Update bonding curve
  bondingCurve.totalTrades = bondingCurve.totalTrades.plus(BigInt.fromI32(1))
  bondingCurve.totalVolume = bondingCurve.totalVolume.plus(event.params.ethAmount)
  bondingCurve.totalFees = bondingCurve.totalFees.plus(trade.platformFee)
  bondingCurve.totalSupply = bondingCurve.totalSupply.minus(event.params.tokenAmount)
  bondingCurve.progress = calculateProgress(bondingCurve.totalSupply)
  bondingCurve.updatedAt = event.block.timestamp
  bondingCurve.save()

  // Update token
  token.totalTrades = token.totalTrades.plus(BigInt.fromI32(1))
  token.totalVolume = token.totalVolume.plus(event.params.ethAmount)
  token.currentPrice = event.params.price
  token.totalSupply = token.totalSupply.minus(event.params.tokenAmount)
  token.marketCap = calculateMarketCap(token.totalSupply, event.params.price)

  // Market data after trade
  trade.marketCapAfter = token.marketCap
  trade.totalSupplyAfter = token.totalSupply
  trade.save()

  token.save()

  // Update token holder
  updateTokenHolder(token.id, event.params.seller, event.params.tokenAmount, false, event.params.price, event.block.timestamp)

  // Update price point for charts
  updatePricePoint(token.id, event.params.price, event.params.ethAmount, event.block.timestamp)

  // Update statistics
  updateUserStats(event.params.seller, event.block.timestamp, false, true, event.params.ethAmount, trade.platformFee)
  updateDailyStats(event.block.timestamp, false, false, event.params.ethAmount, trade.platformFee)
  updatePlatformStats(event.block.timestamp, false, false, event.params.ethAmount, trade.platformFee)
}

// Handle CurveMigration event
export function handleCurveMigration(event: CurveMigration): void {
  let bondingCurve = BondingCurve.load(event.address)
  if (bondingCurve == null) {
    return
  }

  let token = Token.load(bondingCurve.token)
  if (token == null) {
    return
  }

  // Create CurveMigration entity
  let migration = new CurveMigrationEntity(event.transaction.hash)
  migration.token = token.id
  migration.bondingCurve = bondingCurve.id
  migration.finalPrice = event.params.finalPrice
  migration.liquidityETH = event.params.liquidityETH
  migration.liquidityTokens = event.params.liquidityTokens
  migration.liquidityPair = event.params.liquidityPair
  migration.block = event.block.number
  migration.timestamp = event.block.timestamp
  migration.transactionHash = event.transaction.hash
  migration.save()

  // Update bonding curve
  bondingCurve.migrated = true
  bondingCurve.updatedAt = event.block.timestamp
  bondingCurve.save()

  // Update token
  token.migrated = true
  token.migrationTx = event.transaction.hash
  token.migrationBlock = event.block.number
  token.liquidityPair = event.params.liquidityPair
  token.save()

  // Update statistics
  updateDailyStats(event.block.timestamp, false, true, BigInt.fromI32(0), BigInt.fromI32(0))
  updatePlatformStats(event.block.timestamp, false, true, BigInt.fromI32(0), BigInt.fromI32(0))
}

// Handle EmergencyPause event
export function handleEmergencyPause(event: EmergencyPause): void {
  let bondingCurve = BondingCurve.load(event.address)
  if (bondingCurve != null) {
    bondingCurve.paused = true
    bondingCurve.updatedAt = event.block.timestamp
    bondingCurve.save()
  }
}

// Handle EmergencyUnpause event
export function handleEmergencyUnpause(event: EmergencyUnpause): void {
  let bondingCurve = BondingCurve.load(event.address)
  if (bondingCurve != null) {
    bondingCurve.paused = false
    bondingCurve.updatedAt = event.block.timestamp
    bondingCurve.save()
  }
}

// Handle NetworkConfigUpdated event
export function handleNetworkConfigUpdated(event: NetworkConfigUpdated): void {
  let configId = Bytes.fromByteArray(event.params.networkName)
  let config = new NetworkConfig(configId)

  config.chainId = BigInt.fromI32(1) // Will be updated based on network
  config.networkName = event.params.networkName
  config.somniaRouter = event.params.somniaRouter
  config.somniaFactory = event.params.somniaFactory
  config.weth = Address.zero() // Will be set from contract if available
  config.platformFeeBps = BigInt.fromI32(100) // 1% default
  config.creationFee = BigInt.fromString("1000000000000000") // 0.001 ETH
  config.rateLimitSeconds = BigInt.fromI32(60)
  config.updatedAt = event.block.timestamp
  config.updatedBy = event.transaction.from
  config.updateTx = event.transaction.hash

  config.save()
}

// Helper function to calculate platform fee (1% of ETH amount)
function calculatePlatformFee(ethAmount: BigInt): BigInt {
  return ethAmount.times(BigInt.fromI32(100)).div(BigInt.fromI32(10000))
}

// Helper function to calculate creator fee (1% of ETH amount)
function calculateCreatorFee(ethAmount: BigInt): BigInt {
  return ethAmount.times(BigInt.fromI32(100)).div(BigInt.fromI32(10000))
}

// Helper function to calculate progress in basis points
function calculateProgress(totalSupply: BigInt): BigInt {
  let maxSupply = BigInt.fromString("200000000000000000000000000") // 200M tokens for migration
  if (totalSupply.ge(maxSupply)) {
    return BigInt.fromI32(10000) // 100%
  }
  return totalSupply.times(BigInt.fromI32(10000)).div(maxSupply)
}

// Helper function to calculate market cap
function calculateMarketCap(totalSupply: BigInt, price: BigInt): BigInt {
  return totalSupply.times(price).div(BigInt.fromString("1000000000000000000")) // Divide by 1e18 for proper scaling
}

// Helper function to update token holder
function updateTokenHolder(
  tokenId: Bytes,
  holderAddress: Bytes,
  amount: BigInt,
  isBuy: boolean,
  price: BigInt,
  timestamp: BigInt
): void {
  let holderId = tokenId.concat(holderAddress)
  let holder = TokenHolder.load(holderId)

  if (holder == null) {
    holder = new TokenHolder(holderId)
    holder.token = tokenId
    holder.holder = holderAddress
    holder.balance = BigInt.fromI32(0)
    holder.totalBought = BigInt.fromI32(0)
    holder.totalSold = BigInt.fromI32(0)
    holder.totalTrades = BigInt.fromI32(0)
    holder.averagePrice = BigInt.fromI32(0)
    holder.realizedPnL = BigInt.fromI32(0)
    holder.firstTradeAt = timestamp
  }

  if (isBuy) {
    holder.balance = holder.balance.plus(amount)
    holder.totalBought = holder.totalBought.plus(amount)
  } else {
    holder.balance = holder.balance.minus(amount)
    holder.totalSold = holder.totalSold.plus(amount)
    // Calculate realized PnL for sell
    let costBasis = holder.averagePrice.times(amount)
    let sellValue = price.times(amount)
    holder.realizedPnL = holder.realizedPnL.plus(sellValue.minus(costBasis))
  }

  holder.totalTrades = holder.totalTrades.plus(BigInt.fromI32(1))
  holder.lastTradeAt = timestamp

  // Update average price for buys
  if (isBuy && holder.totalBought.gt(BigInt.fromI32(0))) {
    let totalCost = holder.averagePrice.times(holder.totalBought.minus(amount)).plus(price.times(amount))
    holder.averagePrice = totalCost.div(holder.totalBought)
  }

  holder.save()
}

// Helper function to update price points for charts
function updatePricePoint(
  tokenId: Bytes,
  price: BigInt,
  volume: BigInt,
  timestamp: BigInt
): void {
  // Create price points for different intervals
  let intervals: string[] = ["MINUTE_1", "MINUTE_5", "MINUTE_15", "HOUR_1", "HOUR_4", "DAY_1"]
  let intervals_seconds: i32[] = [60, 300, 900, 3600, 14400, 86400]

  for (let i = 0; i < intervals.length; i++) {
    let interval_seconds = intervals_seconds[i]
    let rounded_timestamp = timestamp.div(BigInt.fromI32(interval_seconds)).times(BigInt.fromI32(interval_seconds))

    let pricePointId = tokenId.concat(Bytes.fromUTF8(intervals[i])).concat(Bytes.fromUTF8(rounded_timestamp.toString()))
    let pricePoint = PricePoint.load(pricePointId)

    if (pricePoint == null) {
      pricePoint = new PricePoint(pricePointId)
      pricePoint.token = tokenId
      pricePoint.timestamp = rounded_timestamp
      pricePoint.price = price
      pricePoint.volume = BigInt.fromI32(0)
      pricePoint.trades = BigInt.fromI32(0)
      pricePoint.interval = intervals[i]
      pricePoint.open = price
      pricePoint.high = price
      pricePoint.low = price
      pricePoint.close = price
      pricePoint.marketCap = BigInt.fromI32(0)
      pricePoint.totalSupply = BigInt.fromI32(0)
    }

    // Update OHLC
    if (price.gt(pricePoint.high)) {
      pricePoint.high = price
    }
    if (price.lt(pricePoint.low)) {
      pricePoint.low = price
    }
    pricePoint.close = price

    // Update volume and trades
    pricePoint.volume = pricePoint.volume.plus(volume)
    pricePoint.trades = pricePoint.trades.plus(BigInt.fromI32(1))

    pricePoint.save()
  }
}

// Helper function to update user statistics
function updateUserStats(
  user: Bytes,
  timestamp: BigInt,
  tokenCreated: boolean,
  traded: boolean,
  volume: BigInt,
  fees: BigInt
): void {
  let userStats = UserStats.load(user)

  if (userStats == null) {
    userStats = new UserStats(user)
    userStats.user = user
    userStats.tokensCreated = BigInt.fromI32(0)
    userStats.tokenCreationFees = BigInt.fromI32(0)
    userStats.totalTrades = BigInt.fromI32(0)
    userStats.totalVolume = BigInt.fromI32(0)
    userStats.totalFees = BigInt.fromI32(0)
    userStats.tokensHeld = BigInt.fromI32(0)
    userStats.totalValue = BigInt.fromI32(0)
    userStats.realizedPnL = BigInt.fromI32(0)
    userStats.unrealizedPnL = BigInt.fromI32(0)
    userStats.firstActivityAt = timestamp
  }

  if (traded) {
    userStats.totalTrades = userStats.totalTrades.plus(BigInt.fromI32(1))
    userStats.totalVolume = userStats.totalVolume.plus(volume)
    userStats.totalFees = userStats.totalFees.plus(fees)
  }

  userStats.lastActivityAt = timestamp
  userStats.save()
}

// Helper function to update daily statistics
function updateDailyStats(
  timestamp: BigInt,
  tokenCreated: boolean,
  migration: boolean,
  volume: BigInt,
  fees: BigInt
): void {
  // Calculate day ID (timestamp / 86400)
  let dayId = timestamp.div(BigInt.fromI32(86400))
  let dayStartTimestamp = dayId.times(BigInt.fromI32(86400))

  let stats = DailyStats.load(Bytes.fromUTF8(dayId.toString()))

  if (stats == null) {
    stats = new DailyStats(Bytes.fromUTF8(dayId.toString()))
    stats.date = new Date(dayStartTimestamp.toI32() * 1000).toISOString().split('T')[0]
    stats.tokensCreated = BigInt.fromI32(0)
    stats.totalTokens = BigInt.fromI32(0)
    stats.trades = BigInt.fromI32(0)
    stats.volume = BigInt.fromI32(0)
    stats.fees = BigInt.fromI32(0)
    stats.uniqueTraders = BigInt.fromI32(0)
    stats.migrations = BigInt.fromI32(0)
    stats.totalMigrations = BigInt.fromI32(0)
    stats.gasUsed = BigInt.fromI32(0)
    stats.averageGasPrice = BigInt.fromI32(0)
    stats.highestPrice = BigInt.fromI32(0)
    stats.lowestPrice = BigInt.fromI32(0)
    stats.averagePrice = BigInt.fromI32(0)
  }

  if (tokenCreated) {
    stats.tokensCreated = stats.tokensCreated.plus(BigInt.fromI32(1))
  }

  if (migration) {
    stats.migrations = stats.migrations.plus(BigInt.fromI32(1))
  }

  stats.trades = stats.trades.plus(BigInt.fromI32(1))
  stats.volume = stats.volume.plus(volume)
  stats.fees = stats.fees.plus(fees)

  stats.save()
}

// Helper function to update platform statistics
function updatePlatformStats(
  timestamp: BigInt,
  tokenCreated: boolean,
  migration: boolean,
  volume: BigInt,
  fees: BigInt
): void {
  let stats = PlatformStats.load(Bytes.fromUTF8("platform"))

  if (stats == null) {
    stats = new PlatformStats(Bytes.fromUTF8("platform"))
    stats.totalTokens = BigInt.fromI32(0)
    stats.totalTrades = BigInt.fromI32(0)
    stats.totalVolume = BigInt.fromI32(0)
    stats.totalFees = BigInt.fromI32(0)
    stats.totalUsers = BigInt.fromI32(0)
    stats.totalMigrations = BigInt.fromI32(0)
    stats.activeTokens = BigInt.fromI32(0)
    stats.dailyActiveUsers = BigInt.fromI32(0)
    stats.highestVolumeToken = null
    stats.highestPriceToken = null
    stats.mostTradedToken = null
  }

  if (tokenCreated) {
    stats.totalTokens = stats.totalTokens.plus(BigInt.fromI32(1))
    stats.activeTokens = stats.activeTokens.plus(BigInt.fromI32(1))
  }

  if (migration) {
    stats.totalMigrations = stats.totalMigrations.plus(BigInt.fromI32(1))
    stats.activeTokens = stats.activeTokens.minus(BigInt.fromI32(1))
  }

  stats.totalTrades = stats.totalTrades.plus(BigInt.fromI32(1))
  stats.totalVolume = stats.totalVolume.plus(volume)
  stats.totalFees = stats.totalFees.plus(fees)
  stats.lastUpdated = timestamp

  stats.save()
}