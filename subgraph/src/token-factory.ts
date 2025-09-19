import { BigInt, Address, Bytes } from "@graphprotocol/graph-ts"
import {
  TokenCreated,
  TokenMetadata,
  FeesWithdrawn
} from "../../generated/TokenFactory/TokenFactory"
import {
  LaunchToken as LaunchTokenTemplate,
  HyperBondingCurve as HyperBondingCurveTemplate
} from "../../generated/templates"
import {
  TokenFactory,
  Token,
  BondingCurve,
  DailyStats,
  UserStats,
  PlatformStats
} from "../../generated/schema"

// Initialize or get TokenFactory entity
export function getOrCreateTokenFactory(address: Address): TokenFactory {
  let factory = TokenFactory.load(address)

  if (factory == null) {
    factory = new TokenFactory(address)
    factory.platform = address
    factory.tokenCount = BigInt.fromI32(0)
    factory.totalVolume = BigInt.fromI32(0)
    factory.totalFeesCollected = BigInt.fromI32(0)
    factory.tokenImplementation = Address.zero()
    factory.bondingCurveImplementation = Address.zero()
    factory.createdAt = BigInt.fromI32(0)
    factory.updatedAt = BigInt.fromI32(0)
  }

  return factory
}

// Handle TokenCreated event
export function handleTokenCreated(event: TokenCreated): void {
  // Update factory
  let factory = getOrCreateTokenFactory(event.address)
  factory.tokenCount = factory.tokenCount.plus(BigInt.fromI32(1))
  factory.updatedAt = event.block.timestamp
  factory.save()

  // Create Token entity
  let token = new Token(event.params.token)
  token.factory = factory.id
  token.name = event.params.name
  token.symbol = event.params.symbol
  token.description = ""  // Will be updated in handleTokenMetadata
  token.imageUrl = ""     // Will be updated in handleTokenMetadata
  token.creator = event.params.creator
  token.totalSupply = BigInt.fromI32(0)
  token.creationTime = event.params.timestamp
  token.createdAt = event.block.timestamp

  // Trading statistics
  token.totalTrades = BigInt.fromI32(0)
  token.totalVolume = BigInt.fromI32(0)
  token.currentPrice = BigInt.fromI32(0)
  token.marketCap = BigInt.fromI32(0)
  token.holders = BigInt.fromI32(0)

  // Curve status
  token.migrated = false
  token.migrationTx = null
  token.migrationBlock = null
  token.liquidityPair = null

  token.save()

  // Create BondingCurve entity
  let bondingCurve = new BondingCurve(event.params.bondingCurve)
  bondingCurve.token = token.id
  bondingCurve.creator = event.params.creator

  // Initial curve parameters
  bondingCurve.virtualETH = BigInt.fromString("1000000000000000000") // 1 ETH
  bondingCurve.virtualTokens = BigInt.fromString("800000000000000000000000000") // 800M tokens
  bondingCurve.totalSupply = BigInt.fromI32(0)
  bondingCurve.progress = BigInt.fromI32(0)

  // State
  bondingCurve.migrated = false
  bondingCurve.paused = false

  // Statistics
  bondingCurve.totalTrades = BigInt.fromI32(0)
  bondingCurve.totalVolume = BigInt.fromI32(0)
  bondingCurve.totalFees = BigInt.fromI32(0)

  // Timestamps
  bondingCurve.createdAt = event.block.timestamp
  bondingCurve.updatedAt = event.block.timestamp

  bondingCurve.save()

  // Update token with bonding curve reference
  token.bondingCurve = bondingCurve.id
  token.save()

  // Create templates for tracking events
  LaunchTokenTemplate.create(event.params.token)
  HyperBondingCurveTemplate.create(event.params.bondingCurve)

  // Update user stats
  updateUserStats(event.params.creator, event.block.timestamp, true)

  // Update daily stats
  updateDailyStats(event.block.timestamp, true, false, BigInt.fromI32(0), BigInt.fromI32(0))

  // Update platform stats
  updatePlatformStats(event.block.timestamp, true, false, BigInt.fromI32(0), BigInt.fromI32(0))
}

// Handle TokenMetadata event
export function handleTokenMetadata(event: TokenMetadata): void {
  let token = Token.load(event.params.token)
  if (token != null) {
    token.description = event.params.description
    token.imageUrl = event.params.imageUrl
    token.save()
  }
}

// Handle FeesWithdrawn event
export function handleFeesWithdrawn(event: FeesWithdrawn): void {
  let factory = getOrCreateTokenFactory(event.address)
  factory.totalFeesCollected = factory.totalFeesCollected.plus(event.params.amount)
  factory.updatedAt = event.block.timestamp
  factory.save()
}

// Helper function to update user statistics
function updateUserStats(user: Address, timestamp: BigInt, tokenCreated: boolean): void {
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

  if (tokenCreated) {
    userStats.tokensCreated = userStats.tokensCreated.plus(BigInt.fromI32(1))
    userStats.tokenCreationFees = userStats.tokenCreationFees.plus(BigInt.fromString("1000000000000000")) // 0.001 ETH
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

  stats.totalVolume = stats.totalVolume.plus(volume)
  stats.totalFees = stats.totalFees.plus(fees)
  stats.lastUpdated = timestamp

  stats.save()
}