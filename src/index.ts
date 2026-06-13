import logger from './utils/logger';
import config from './config/config';
import BinanceClient from './exchange/binanceClient';
import TradingStrategy from './strategy/tradingStrategy';
import PortfolioManager from './trading/portfolio';

interface TradeState {
  currentPosition: any | null;
  lastDecision: any | null;
  accountBalance: number;
}

class TradingBot {
  private binanceClient: BinanceClient;
  private tradingStrategy: TradingStrategy;
  private portfolio: PortfolioManager;
  private state: TradeState;
  private running: boolean = false;
  private updateInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.binanceClient = new BinanceClient();
    this.tradingStrategy = new TradingStrategy();
    this.portfolio = new PortfolioManager(config.trading.positionSize * 10); // Start with 10x position size
    this.state = {
      currentPosition: null,
      lastDecision: null,
      accountBalance: config.trading.positionSize * 10,
    };

    logger.info('Trading bot initialized');
    logger.info(`Configuration: ${JSON.stringify({
      pair: config.trading.pair,
      liveTrading: config.trading.liveTrading,
      positionSize: config.trading.positionSize,
      confidenceThreshold: config.ml.confidenceThreshold,
    }, null, 2)}`);
  }

  /**
   * Main trading loop
   */
  private async tradingLoop(): Promise<void> {
    try {
      logger.info('=== Trading Cycle Started ===');

      // Get current price and candles
      const currentPrice = await this.binanceClient.getCurrentPrice();
      const candles = await this.binanceClient.getCandles('1h', config.ml.lookbackPeriod);

      if (candles.length === 0) {
        logger.warn('No candle data available');
        return;
      }

      // Generate trading decision
      const decision = await this.tradingStrategy.generateTradingDecision(
        candles,
        currentPrice,
        config.trading.pair
      );

      this.state.lastDecision = decision;

      // Get current positions
      const openPositions = this.portfolio.getOpenPositions();

      // Handle position exit if one is open
      if (openPositions.length > 0) {
        const position = openPositions[0];
        const { shouldExit, reason } = this.tradingStrategy.shouldExitPosition(
          position.entryPrice,
          currentPrice,
          position.type
        );

        if (shouldExit) {
          logger.info(`Exiting position: ${reason}`);
          this.portfolio.closePosition(position.id, currentPrice);
          this.state.currentPosition = null;
        } else {
          logger.info(`Position still active. Entry: $${position.entryPrice}, Current: $${currentPrice}`);
        }
      }

      // Handle new position entry
      if (openPositions.length === 0 && decision.action !== 'HOLD') {
        if (decision.confidence >= config.ml.confidenceThreshold) {
          const quantity = this.portfolio.calculatePositionSize(currentPrice, this.state.accountBalance);

          if (this.portfolio.canOpenPosition(currentPrice, quantity)) {
            try {
              let orderId: string | undefined;

              if (decision.action === 'BUY') {
                const order = await this.binanceClient.placeBuyOrder(quantity);
                orderId = order.orderId;
                logger.info(`BUY order executed: ${order.orderId}`);
              } else if (decision.action === 'SELL') {
                const order = await this.binanceClient.placeSellOrder(quantity);
                orderId = order.orderId;
                logger.info(`SELL order executed: ${order.orderId}`);
              }

              // Record position
              const position = this.portfolio.openPosition(
                config.trading.pair,
                decision.action === 'BUY' ? 'LONG' : 'SHORT',
                currentPrice,
                quantity,
                orderId
              );

              this.state.currentPosition = position;
            } catch (error) {
              logger.error(`Error executing trade: ${error}`);
            }
          } else {
            logger.warn('Insufficient funds to open position');
          }
        } else {
          logger.info(`Decision confidence below threshold: ${decision.confidence}`);
        }
      }

      // Log current portfolio state
      const balances = await this.binanceClient.getBalance();
      logger.info(`Current balances: ${JSON.stringify(balances, null, 2)}`);

      logger.info('=== Trading Cycle Completed ===\n');
    } catch (error) {
      logger.error(`Error in trading loop: ${error}`);
    }
  }

  /**
   * Start the trading bot
   */
  async start(intervalMinutes: number = 60): Promise<void> {
    if (this.running) {
      logger.warn('Bot is already running');
      return;
    }

    this.running = true;
    logger.info(`Starting trading bot. Update interval: ${intervalMinutes} minutes`);

    // Run immediately
    await this.tradingLoop();

    // Schedule recurring updates
    this.updateInterval = setInterval(async () => {
      await this.tradingLoop();
    }, intervalMinutes * 60 * 1000);

    logger.info('Trading bot is now running');
  }

  /**
   * Stop the trading bot
   */
  stop(): void {
    if (!this.running) {
      logger.warn('Bot is not running');
      return;
    }

    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }

    this.running = false;
    logger.info('Trading bot stopped');
  }

  /**
   * Get bot status
   */
  getStatus(): any {
    return {
      running: this.running,
      currentPosition: this.state.currentPosition,
      lastDecision: this.state.lastDecision,
      openPositions: this.portfolio.getOpenPositions(),
    };
  }
}

// Main execution
async function main() {
  try {
    const bot = new TradingBot();

    // Handle graceful shutdown
    process.on('SIGINT', () => {
      logger.info('Received SIGINT, shutting down...');
      bot.stop();
      process.exit(0);
    });

    // Start the bot (update every 1 hour)
    await bot.start(1);

    // Keep process alive
    setInterval(() => {
      const status = bot.getStatus();
      logger.info(`Bot status: ${JSON.stringify(status)}`);
    }, 5 * 60 * 1000); // Log status every 5 minutes
  } catch (error) {
    logger.error(`Fatal error: ${error}`);
    process.exit(1);
  }
}

// Start if this is the main module
if (require.main === module) {
  main().catch(err => {
    logger.error(`Unhandled error: ${err}`);
    process.exit(1);
  });
}

export default TradingBot;
