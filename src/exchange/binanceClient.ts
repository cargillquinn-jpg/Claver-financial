import Binance from 'binance-api-node';
import config from '../config/config';
import logger from '../utils/logger';

interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface TradeSignal {
  action: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  price: number;
  timestamp: number;
}

class BinanceClient {
  private client: ReturnType<typeof Binance>;
  private pair: string;

  constructor() {
    this.client = Binance({
      apiKey: config.binance.apiKey,
      apiSecret: config.binance.apiSecret,
    });
    this.pair = config.trading.pair;
  }

  /**
   * Get current price for the trading pair
   */
  async getCurrentPrice(): Promise<number> {
    try {
      const ticker = await this.client.prices({ symbol: this.pair });
      const price = parseFloat(ticker[this.pair]);
      logger.info(`Current ${this.pair} price: $${price}`);
      return price;
    } catch (error) {
      logger.error(`Error fetching current price: ${error}`);
      throw error;
    }
  }

  /**
   * Get historical candle data for technical analysis
   * @param interval - Candle interval (1m, 5m, 15m, 1h, 4h, 1d, etc.)
   * @param limit - Number of candles to fetch
   */
  async getCandles(interval: string = '1h', limit: number = 100): Promise<Candle[]> {
    try {
      const candles = await this.client.candles({
        symbol: this.pair,
        interval,
        limit,
      });

      return candles.map((candle) => ({
        time: candle.openTime,
        open: parseFloat(candle.open),
        high: parseFloat(candle.high),
        low: parseFloat(candle.low),
        close: parseFloat(candle.close),
        volume: parseFloat(candle.volume),
      }));
    } catch (error) {
      logger.error(`Error fetching candles: ${error}`);
      throw error;
    }
  }

  /**
   * Get current wallet balance
   */
  async getBalance(): Promise<{ [key: string]: { available: number; locked: number } }> {
    try {
      const account = await this.client.accountInfo();
      const balances: { [key: string]: { available: number; locked: number } } = {};

      account.balances.forEach((balance) => {
        if (parseFloat(balance.free) > 0 || parseFloat(balance.locked) > 0) {
          balances[balance.asset] = {
            available: parseFloat(balance.free),
            locked: parseFloat(balance.locked),
          };
        }
      });

      logger.info(`Account balance retrieved. ${Object.keys(balances).length} assets`);
      return balances;
    } catch (error) {
      logger.error(`Error fetching balance: ${error}`);
      throw error;
    }
  }

  /**
   * Place a BUY market order
   */
  async placeBuyOrder(quantity: number): Promise<any> {
    if (!config.trading.liveTrading) {
      logger.warn(`PAPER TRADING MODE: Would execute BUY order for ${quantity} ${this.pair}`);
      return { orderId: 'PAPER_' + Date.now(), status: 'PAPER_SIMULATED' };
    }

    try {
      const order = await this.client.order({
        symbol: this.pair,
        side: 'BUY',
        quantity,
        type: 'MARKET',
      });

      logger.info(`BUY order placed: ${order.orderId}, Quantity: ${quantity}`);
      return order;
    } catch (error) {
      logger.error(`Error placing BUY order: ${error}`);
      throw error;
    }
  }

  /**
   * Place a SELL market order
   */
  async placeSellOrder(quantity: number): Promise<any> {
    if (!config.trading.liveTrading) {
      logger.warn(`PAPER TRADING MODE: Would execute SELL order for ${quantity} ${this.pair}`);
      return { orderId: 'PAPER_' + Date.now(), status: 'PAPER_SIMULATED' };
    }

    try {
      const order = await this.client.order({
        symbol: this.pair,
        side: 'SELL',
        quantity,
        type: 'MARKET',
      });

      logger.info(`SELL order placed: ${order.orderId}, Quantity: ${quantity}`);
      return order;
    } catch (error) {
      logger.error(`Error placing SELL order: ${error}`);
      throw error;
    }
  }

  /**
   * Get open orders for the trading pair
   */
  async getOpenOrders(): Promise<any[]> {
    try {
      const orders = await this.client.openOrders({ symbol: this.pair });
      logger.info(`Retrieved ${orders.length} open orders for ${this.pair}`);
      return orders;
    } catch (error) {
      logger.error(`Error fetching open orders: ${error}`);
      throw error;
    }
  }

  /**
   * Cancel an order
   */
  async cancelOrder(orderId: string): Promise<any> {
    if (!config.trading.liveTrading) {
      logger.warn(`PAPER TRADING MODE: Would cancel order ${orderId}`);
      return { orderId, status: 'PAPER_SIMULATED' };
    }

    try {
      const result = await this.client.cancelOrder({
        symbol: this.pair,
        orderId: parseInt(orderId),
      });

      logger.info(`Order cancelled: ${orderId}`);
      return result;
    } catch (error) {
      logger.error(`Error cancelling order: ${error}`);
      throw error;
    }
  }
}

export default BinanceClient;
