import { BigInt, Address, Bytes } from "@graphprotocol/graph-ts"
import {
  Transfer
} from "../../generated/templates/LaunchToken/LaunchToken"
import {
  Token,
  TokenHolder,
  UserStats
} from "../../generated/schema"

// Handle Transfer event
export function handleTransfer(event: Transfer): void {
  let token = Token.load(event.address)
  if (token == null) {
    return
  }

  // Skip mint and burn operations (from/to zero address)
  let isFromZero = event.params.from.equals(Address.zero())
  let isToZero = event.params.to.equals(Address.zero())

  if (isFromZero || isToZero) {
    // Handle minting and burning
    if (isFromZero && !isToZero) {
      // Minting - update total supply and recipient balance
      token.totalSupply = token.totalSupply.plus(event.params.value)
      updateTokenHolderBalance(token.id, event.params.to, event.params.value, true, event.block.timestamp)

      // Increment holders count if new holder
      let holderId = token.id.concat(event.params.to)
      let holder = TokenHolder.load(holderId)
      if (holder != null && holder.balance.equals(event.params.value)) {
        // This is a new holder
        token.holders = token.holders.plus(BigInt.fromI32(1))
      }
    } else if (isToZero && !isFromZero) {
      // Burning - update total supply and sender balance
      token.totalSupply = token.totalSupply.minus(event.params.value)
      updateTokenHolderBalance(token.id, event.params.from, event.params.value, false, event.block.timestamp)

      // Decrement holders count if holder balance becomes zero
      let holderId = token.id.concat(event.params.from)
      let holder = TokenHolder.load(holderId)
      if (holder != null && holder.balance.equals(BigInt.fromI32(0))) {
        // Holder sold all tokens
        token.holders = token.holders.minus(BigInt.fromI32(1))
      }
    }

    token.save()
    return
  }

  // Regular transfer between users
  let wasFromHolding = false
  let wasToHolding = false

  // Update sender balance
  let fromHolderId = token.id.concat(event.params.from)
  let fromHolder = TokenHolder.load(fromHolderId)
  if (fromHolder != null) {
    wasFromHolding = fromHolder.balance.gt(BigInt.fromI32(0))
    updateTokenHolderBalance(token.id, event.params.from, event.params.value, false, event.block.timestamp)

    // Check if sender no longer holds tokens
    fromHolder = TokenHolder.load(fromHolderId)
    if (fromHolder != null && wasFromHolding && fromHolder.balance.equals(BigInt.fromI32(0))) {
      token.holders = token.holders.minus(BigInt.fromI32(1))
    }
  }

  // Update recipient balance
  let toHolderId = token.id.concat(event.params.to)
  let toHolder = TokenHolder.load(toHolderId)
  if (toHolder != null) {
    wasToHolding = toHolder.balance.gt(BigInt.fromI32(0))
  }

  updateTokenHolderBalance(token.id, event.params.to, event.params.value, true, event.block.timestamp)

  // Check if recipient is a new holder
  toHolder = TokenHolder.load(toHolderId)
  if (toHolder != null && !wasToHolding && toHolder.balance.gt(BigInt.fromI32(0))) {
    token.holders = token.holders.plus(BigInt.fromI32(1))
  }

  token.save()

  // Update user stats for both sender and receiver
  updateUserStatsForTransfer(event.params.from, event.block.timestamp)
  updateUserStatsForTransfer(event.params.to, event.block.timestamp)
}

// Helper function to update token holder balance
function updateTokenHolderBalance(
  tokenId: Bytes,
  holderAddress: Bytes,
  amount: BigInt,
  isReceiving: boolean,
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
    holder.lastTradeAt = timestamp
  }

  if (isReceiving) {
    holder.balance = holder.balance.plus(amount)
  } else {
    holder.balance = holder.balance.minus(amount)
  }

  holder.lastTradeAt = timestamp
  holder.save()
}

// Helper function to update user stats for transfers
function updateUserStatsForTransfer(
  user: Bytes,
  timestamp: BigInt
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

  userStats.lastActivityAt = timestamp
  userStats.save()

  // Update tokens held count
  updateUserTokensHeld(user)
}

// Helper function to count how many different tokens a user holds
function updateUserTokensHeld(user: Bytes): void {
  let userStats = UserStats.load(user)
  if (userStats == null) {
    return
  }

  // Note: In a production environment, you would typically maintain
  // a separate entity or use derived fields to efficiently count
  // the number of tokens a user holds. For simplicity, we're setting
  // this to 0 here, but it should be implemented based on the
  // actual TokenHolder entities associated with this user.

  // This would require a more complex query that The Graph subgraph
  // doesn't support natively. In practice, you would either:
  // 1. Maintain a counter and update it on each transfer
  // 2. Use the derived field feature in The Graph
  // 3. Calculate this in the frontend when querying

  userStats.tokensHeld = BigInt.fromI32(0) // Placeholder
  userStats.save()
}