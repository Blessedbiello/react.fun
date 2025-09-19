/**
 * @title SomniaWebSocketService
 * @dev Real-time WebSocket integration for Somnia Network
 * @notice Implements Somnia-specific WebSocket patterns for price feeds and event monitoring
 */

import { ethers } from 'ethers';

// Somnia Network WebSocket Configuration
const SOMNIA_WS_URL = 'wss://dream-rpc.somnia.network/ws';
const RECONNECT_DELAY = 5000; // 5 seconds
const HEARTBEAT_INTERVAL = 30000; // 30 seconds
const MAX_RECONNECT_ATTEMPTS = 10;

export interface PriceUpdate {
  tokenAddress: string;
  price: bigint;
  ethIn: bigint;
  tokensOut: bigint;
  buyer: string;
  timestamp: number;
  blockNumber: number;
}

export interface TradeEvent {
  type: 'buy' | 'sell';
  tokenAddress: string;
  trader: string;
  ethAmount: bigint;
  tokenAmount: bigint;
  newPrice: bigint;
  timestamp: number;
  transactionHash: string;
}

export interface CurveMigrationEvent {
  tokenAddress: string;
  finalPrice: bigint;
  liquidityETH: bigint;
  liquidityTokens: bigint;
  liquidityPair: string;
  timestamp: number;
}

export class SomniaWebSocketService {
  private provider: ethers.WebSocketProvider | null = null;
  private reconnectAttempts = 0;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private isConnected = false;
  private subscribers = new Map<string, Set<Function>>();
  private eventFilters = new Map<string, any>();

  constructor() {
    this.connect();
  }

  /**
   * @dev Establish WebSocket connection to Somnia Network
   */
  private async connect(): Promise<void> {
    try {
      console.log('Connecting to Somnia WebSocket...');
      this.provider = new ethers.WebSocketProvider(SOMNIA_WS_URL);

      // Wait for connection
      await this.provider.ready;

      this.isConnected = true;
      this.reconnectAttempts = 0;
      console.log('✅ Connected to Somnia WebSocket');

      // Setup heartbeat
      this.startHeartbeat();

      // Setup connection event handlers
      this.setupConnectionHandlers();

      // Restore previous subscriptions
      this.restoreSubscriptions();

    } catch (error) {
      console.error('❌ Failed to connect to Somnia WebSocket:', error);
      this.handleReconnect();
    }
  }

  /**
   * @dev Setup WebSocket connection event handlers
   */
  private setupConnectionHandlers(): void {
    if (!this.provider) return;

    this.provider.websocket.onclose = () => {
      console.log('🔌 Somnia WebSocket connection closed');
      this.isConnected = false;
      this.stopHeartbeat();
      this.handleReconnect();
    };

    this.provider.websocket.onerror = (error: any) => {
      console.error('❌ Somnia WebSocket error:', error);
      this.isConnected = false;
    };
  }

  /**
   * @dev Handle reconnection with exponential backoff
   */
  private handleReconnect(): void {
    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      console.error('❌ Max reconnection attempts reached');
      return;
    }

    const delay = RECONNECT_DELAY * Math.pow(2, this.reconnectAttempts);
    this.reconnectAttempts++;

    console.log(`🔄 Reconnecting to Somnia WebSocket in ${delay}ms (attempt ${this.reconnectAttempts})`);

    setTimeout(() => {
      this.connect();
    }, delay);
  }

  /**
   * @dev Start heartbeat to maintain connection
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(async () => {
      if (!this.provider || !this.isConnected) return;

      try {
        // Send ping by requesting latest block number
        await this.provider.getBlockNumber();
      } catch (error) {
        console.error('💓 Heartbeat failed:', error);
        this.isConnected = false;
        this.handleReconnect();
      }
    }, HEARTBEAT_INTERVAL);
  }

  /**
   * @dev Stop heartbeat
   */
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * @dev Subscribe to token price updates
   */
  public subscribeToPriceUpdates(
    tokenAddress: string,
    callback: (update: PriceUpdate) => void
  ): () => void {
    const eventKey = `price_${tokenAddress.toLowerCase()}`;

    // Add callback to subscribers
    if (!this.subscribers.has(eventKey)) {
      this.subscribers.set(eventKey, new Set());
    }
    this.subscribers.get(eventKey)!.add(callback);

    // Setup event filter if not exists
    if (!this.eventFilters.has(eventKey) && this.provider) {
      const filter = {
        address: tokenAddress,
        topics: [
          ethers.id("TokenPurchase(address,uint256,uint256,uint256)")
        ]
      };

      this.eventFilters.set(eventKey, filter);

      this.provider.on(filter, async (log) => {
        try {
          const decoded = ethers.AbiCoder.defaultAbiCoder().decode(
            ['address', 'uint256', 'uint256', 'uint256'],
            log.data
          );

          const update: PriceUpdate = {
            tokenAddress: log.address,
            price: decoded[3],
            ethIn: decoded[1],
            tokensOut: decoded[2],
            buyer: decoded[0],
            timestamp: Date.now(),
            blockNumber: log.blockNumber
          };

          // Notify all subscribers
          this.subscribers.get(eventKey)?.forEach(cb => {
            try {
              cb(update);
            } catch (error) {
              console.error('Error in price update callback:', error);
            }
          });

        } catch (error) {
          console.error('Error parsing price update:', error);
        }
      });
    }

    // Return unsubscribe function
    return () => {
      this.subscribers.get(eventKey)?.delete(callback);
      if (this.subscribers.get(eventKey)?.size === 0) {
        this.subscribers.delete(eventKey);
        // Remove event listener if no more subscribers
        if (this.provider && this.eventFilters.has(eventKey)) {
          this.provider.off(this.eventFilters.get(eventKey));
          this.eventFilters.delete(eventKey);
        }
      }
    };
  }

  /**
   * @dev Subscribe to all trading events for a token
   */
  public subscribeToTradeEvents(
    tokenAddress: string,
    callback: (event: TradeEvent) => void
  ): () => void {
    const buyEventKey = `trade_buy_${tokenAddress.toLowerCase()}`;
    const sellEventKey = `trade_sell_${tokenAddress.toLowerCase()}`;

    // Subscribe to buy events
    const unsubscribeBuy = this.subscribeToEvent(
      buyEventKey,
      {
        address: tokenAddress,
        topics: [ethers.id("TokenPurchase(address,uint256,uint256,uint256)")]
      },
      (log) => {
        const decoded = ethers.AbiCoder.defaultAbiCoder().decode(
          ['address', 'uint256', 'uint256', 'uint256'],
          log.data
        );

        const event: TradeEvent = {
          type: 'buy',
          tokenAddress: log.address,
          trader: decoded[0],
          ethAmount: decoded[1],
          tokenAmount: decoded[2],
          newPrice: decoded[3],
          timestamp: Date.now(),
          transactionHash: log.transactionHash
        };

        callback(event);
      }
    );

    // Subscribe to sell events
    const unsubscribeSell = this.subscribeToEvent(
      sellEventKey,
      {
        address: tokenAddress,
        topics: [ethers.id("TokenSale(address,uint256,uint256,uint256)")]
      },
      (log) => {
        const decoded = ethers.AbiCoder.defaultAbiCoder().decode(
          ['address', 'uint256', 'uint256', 'uint256'],
          log.data
        );

        const event: TradeEvent = {
          type: 'sell',
          tokenAddress: log.address,
          trader: decoded[0],
          tokenAmount: decoded[1],
          ethAmount: decoded[2],
          newPrice: decoded[3],
          timestamp: Date.now(),
          transactionHash: log.transactionHash
        };

        callback(event);
      }
    );

    // Return combined unsubscribe function
    return () => {
      unsubscribeBuy();
      unsubscribeSell();
    };
  }

  /**
   * @dev Subscribe to curve migration events
   */
  public subscribeToCurveMigration(
    tokenAddress: string,
    callback: (event: CurveMigrationEvent) => void
  ): () => void {
    const eventKey = `migration_${tokenAddress.toLowerCase()}`;

    return this.subscribeToEvent(
      eventKey,
      {
        address: tokenAddress,
        topics: [ethers.id("CurveMigration(uint256,uint256,uint256,address)")]
      },
      (log) => {
        const decoded = ethers.AbiCoder.defaultAbiCoder().decode(
          ['uint256', 'uint256', 'uint256', 'address'],
          log.data
        );

        const event: CurveMigrationEvent = {
          tokenAddress: log.address,
          finalPrice: decoded[0],
          liquidityETH: decoded[1],
          liquidityTokens: decoded[2],
          liquidityPair: decoded[3],
          timestamp: Date.now()
        };

        callback(event);
      }
    );
  }

  /**
   * @dev Generic event subscription helper
   */
  private subscribeToEvent(
    eventKey: string,
    filter: any,
    parser: (log: any) => void
  ): () => void {
    if (!this.subscribers.has(eventKey)) {
      this.subscribers.set(eventKey, new Set());
    }
    this.subscribers.get(eventKey)!.add(parser);

    if (!this.eventFilters.has(eventKey) && this.provider) {
      this.eventFilters.set(eventKey, filter);

      this.provider.on(filter, (log) => {
        try {
          parser(log);
        } catch (error) {
          console.error(`Error parsing event ${eventKey}:`, error);
        }
      });
    }

    return () => {
      this.subscribers.get(eventKey)?.delete(parser);
      if (this.subscribers.get(eventKey)?.size === 0) {
        this.subscribers.delete(eventKey);
        if (this.provider && this.eventFilters.has(eventKey)) {
          this.provider.off(this.eventFilters.get(eventKey));
          this.eventFilters.delete(eventKey);
        }
      }
    };
  }

  /**
   * @dev Restore subscriptions after reconnection
   */
  private restoreSubscriptions(): void {
    if (!this.provider) return;

    // Re-establish all event listeners
    this.eventFilters.forEach((filter, eventKey) => {
      this.provider!.on(filter, (log) => {
        // Re-execute all callbacks for this event
        this.subscribers.get(eventKey)?.forEach(callback => {
          try {
            callback(log);
          } catch (error) {
            console.error(`Error in restored callback for ${eventKey}:`, error);
          }
        });
      });
    });
  }

  /**
   * @dev Get connection status
   */
  public getStatus(): {
    connected: boolean;
    reconnectAttempts: number;
    activeSubscriptions: number;
  } {
    return {
      connected: this.isConnected,
      reconnectAttempts: this.reconnectAttempts,
      activeSubscriptions: this.subscribers.size
    };
  }

  /**
   * @dev Disconnect and cleanup
   */
  public disconnect(): void {
    console.log('🔌 Disconnecting from Somnia WebSocket');

    this.stopHeartbeat();
    this.isConnected = false;

    if (this.provider) {
      this.provider.destroy();
      this.provider = null;
    }

    this.subscribers.clear();
    this.eventFilters.clear();
    this.reconnectAttempts = 0;
  }
}

// Singleton instance
let somniaWebSocketInstance: SomniaWebSocketService | null = null;

/**
 * @dev Get singleton WebSocket service instance
 */
export function getSomniaWebSocket(): SomniaWebSocketService {
  if (!somniaWebSocketInstance) {
    somniaWebSocketInstance = new SomniaWebSocketService();
  }
  return somniaWebSocketInstance;
}

/**
 * @dev Cleanup WebSocket service
 */
export function cleanupSomniaWebSocket(): void {
  if (somniaWebSocketInstance) {
    somniaWebSocketInstance.disconnect();
    somniaWebSocketInstance = null;
  }
}