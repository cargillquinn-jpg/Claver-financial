import logger from '../utils/logger';
import config from '../config/config';

interface Position {
  id: string;
  pair: string;
  type: 'LONG' | 'SHORT';
  entryPrice: number;
  quantity: number;
  entryTime: number;
  orderId?: string;
}

interface Portfolio {
  positions: Position[];
  cash: number;
  totalValue: number;
  unrealizedPnL: number;
  realizedPnL: number;
}

class PortfolioManager {
  private positions: Position[] = [];
  private cash: number = 0;
  private realizedPnL: number = 0;
  private tradingHistory: any[] = [];

  constructor(initialBalance: number) {
    this.cash = initialBalance;
    logger.info(`Portfolio initialized with ${initialBalance} USDT`);
  }

  /**
   * Open a new position
   */
  openPosition(
    pair: string,
    type: 'LONG' | 'SHORT',
    entryPrice: number,
    quantity: number,
    orderId?: string
  ): Position {
    if (this.positions.length >= config.trading.maxPositions) {
      throw new Error(`Maximum positions (${config.trading.maxPositions}) reached`);
    }

    const positionCost = entryPrice * quantity;
    if (this.cash < positionCost) {
      throw new Error(`Insufficient cash. Need ${positionCost}, have ${this.cash}`);
    }

    const position: Position = {
      id: `pos_${Date.now()}`,
      pair,
      type,
      entryPrice,
      quantity,
      entryTime: Date.now(),
      orderId,
    };

    this.positions.push(position);
    this.cash -= positionCost;

    logger.info(
      `Position opened: ${type} ${quantity} ${pair} at $${entryPrice} ` +
      `(Cost: ${positionCost} USDT, Remaining cash: ${this.cash} USDT)`
    );

    return position;
  }

  /**
   * Close an existing position
   */
  closePosition(positionId: string, exitPrice: number): void {
    const position = this.positions.find(p => p.id === positionId);
    if (!position) {
      throw new Error(`Position ${positionId} not found`);
    }

    const exitValue = exitPrice * position.quantity;
    const pnl = position.type === 'LONG' 
      ? (exitPrice - position.entryPrice) * position.quantity
      : (position.entryPrice - exitPrice) * position.quantity;

    this.cash += exitValue;
    this.realizedPnL += pnl;

    const pnlPercent = (pnl / (position.entryPrice * position.quantity)) * 100;

    logger.info(
      `Position closed: ${position.type} ${position.quantity} ${position.pair} ` +
      `at $${exitPrice} | PnL: ${pnl.toFixed(2)} USDT (${pnlPercent.toFixed(2)}%)`
    );

    this.positions = this.positions.filter(p => p.id !== positionId);
  }

  /**
   * Get current portfolio state
   */
  getPortfolioState(currentPrices: { [key: string]: number }): Portfolio {
    let unrealizedPnL = 0;
    let positionValue = 0;

    this.positions.forEach(position => {
      const currentPrice = currentPrices[position.pair] || position.entryPrice;
      const quantity = position.quantity;
      
      if (position.type === 'LONG') {
        unrealizedPnL += (currentPrice - position.entryPrice) * quantity;
        positionValue += currentPrice * quantity;
      } else {
        unrealizedPnL += (position.entryPrice - currentPrice) * quantity;
        positionValue += position.entryPrice * quantity;
      }
    });

    const totalValue = this.cash + positionValue;

    return {
      positions: this.positions,
      cash: this.cash,
      totalValue,
      unrealizedPnL,
      realizedPnL: this.realizedPnL,
    };
  }

  /**
   * Get total account value
   */
  getTotalAccountValue(currentPrices: { [key: string]: number }): number {
    const portfolio = this.getPortfolioState(currentPrices);
    return portfolio.totalValue;
  }

  /**
   * Get all open positions
   */
  getOpenPositions(): Position[] {
    return [...this.positions];
  }

  /**
   * Get position by ID
   */
  getPositionById(positionId: string): Position | undefined {
    return this.positions.find(p => p.id === positionId);
  }

  /**
   * Check if we can open a new position
   */
  canOpenPosition(entryPrice: number, quantity: number): boolean {
    if (this.positions.length >= config.trading.maxPositions) {
      return false;
    }

    const cost = entryPrice * quantity;
    return this.cash >= cost;
  }

  /**
   * Calculate position sizing based on risk management
   */
  calculatePositionSize(entryPrice: number, accountBalance: number): number {
    // Risk 1-2% of account per trade
    const riskPercent = 0.01; // 1%
    const riskAmount = accountBalance * riskPercent;
    const stopLossAmount = entryPrice * config.trading.stopLossPercent;
    
    const quantity = riskAmount / stopLossAmount;
    return Math.floor(quantity * 100) / 100; // Round to 2 decimals
  }

  /**
   * Add trade to history
   */
  recordTrade(trade: any): void {
    this.tradingHistory.push({
      ...trade,
      timestamp: Date.now(),
    });
  }

  /**
   * Get trading history
   */
  getTradingHistory(): any[] {
    return [...this.tradingHistory];
  }

  /**
   * Calculate performance metrics
   */
  getPerformanceMetrics(initialBalance: number): {
    totalReturn: number;
    totalReturnPercent: number;
    winRate: number;
    averageWin: number;
    averageLoss: number;
    profitFactor: number;
  } {
    const totalReturn = this.realizedPnL;
    const totalReturnPercent = (totalReturn / initialBalance) * 100;

    const wins = this.tradingHistory.filter(t => t.pnl > 0);
    const losses = this.tradingHistory.filter(t => t.pnl < 0);

    const winRate = wins.length / (wins.length + losses.length || 1);
    const averageWin = wins.length > 0 ? wins.reduce((sum, t) => sum + t.pnl, 0) / wins.length : 0;
    const averageLoss = losses.length > 0 ? losses.reduce((sum, t) => sum + t.pnl, 0) / losses.length : 0;

    const totalWins = wins.reduce((sum, t) => sum + t.pnl, 0);
    const totalLosses = Math.abs(losses.reduce((sum, t) => sum + t.pnl, 0));
    const profitFactor = totalLosses > 0 ? totalWins / totalLosses : totalWins > 0 ? Infinity : 0;

    return {
      totalReturn,
      totalReturnPercent,
      winRate,
      averageWin,
      averageLoss,
      profitFactor,
    };
  }
}

export default PortfolioManager;
