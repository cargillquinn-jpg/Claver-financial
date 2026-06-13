import { SMA, RSI, MACD, BollingerBands, ATR } from 'technicalindicators';
import logger from '../utils/logger';

interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface TechnicalIndicators {
  sma20: number;
  sma50: number;
  rsi: number;
  macd: {
    value: number;
    signal: number;
    histogram: number;
  };
  bollingerBands: {
    upper: number;
    middle: number;
    lower: number;
  };
  atr: number;
}

class TechnicalAnalysis {
  /**
   * Calculate all technical indicators for the given candles
   */
  static calculateIndicators(candles: Candle[]): TechnicalIndicators {
    const closes = candles.map(c => c.close);
    const highs = candles.map(c => c.high);
    const lows = candles.map(c => c.low);

    try {
      // Simple Moving Averages
      const sma20Values = SMA.calculate({ values: closes, period: 20 });
      const sma50Values = SMA.calculate({ values: closes, period: 50 });

      const sma20 = sma20Values.length > 0 ? sma20Values[sma20Values.length - 1] : closes[closes.length - 1];
      const sma50 = sma50Values.length > 0 ? sma50Values[sma50Values.length - 1] : closes[closes.length - 1];

      // Relative Strength Index
      const rsiValues = RSI.calculate({ values: closes, period: 14 });
      const rsi = rsiValues.length > 0 ? rsiValues[rsiValues.length - 1] : 50;

      // MACD
      const macdResult = MACD.calculate({
        values: closes,
        fastPeriod: 12,
        slowPeriod: 26,
        signalPeriod: 9,
        SimpleMAOscillator: false,
        SimpleMASignal: false,
      });

      const macd = macdResult.length > 0 ? macdResult[macdResult.length - 1] : { MACD: 0, signal: 0, histogram: 0 };

      // Bollinger Bands
      const bbResult = BollingerBands.calculate({
        values: closes,
        period: 20,
        stdDev: 2,
      });

      const bb = bbResult.length > 0 ? bbResult[bbResult.length - 1] : { upper: closes[closes.length - 1], middle: closes[closes.length - 1], lower: closes[closes.length - 1] };

      // Average True Range
      const atrValues = ATR.calculate({
        high: highs,
        low: lows,
        close: closes,
        period: 14,
      });

      const atr = atrValues.length > 0 ? atrValues[atrValues.length - 1] : 0;

      logger.debug('Technical indicators calculated successfully');

      return {
        sma20,
        sma50,
        rsi,
        macd: {
          value: macd.MACD,
          signal: macd.signal,
          histogram: macd.histogram,
        },
        bollingerBands: {
          upper: bb.upper,
          middle: bb.middle,
          lower: bb.lower,
        },
        atr,
      };
    } catch (error) {
      logger.error(`Error calculating technical indicators: ${error}`);
      throw error;
    }
  }

  /**
   * Generate trading signals based on technical indicators
   */
  static generateSignal(indicators: TechnicalIndicators, currentPrice: number): { signal: 'BUY' | 'SELL' | 'HOLD'; score: number } {
    let buyScore = 0;
    let sellScore = 0;

    // SMA crossover signal
    if (indicators.sma20 > indicators.sma50) {
      buyScore += 2;
    } else {
      sellScore += 2;
    }

    // RSI signal (0-30 oversold, 70-100 overbought)
    if (indicators.rsi < 30) {
      buyScore += 2;
    } else if (indicators.rsi > 70) {
      sellScore += 2;
    }

    // MACD signal
    if (indicators.macd.histogram > 0 && indicators.macd.value > indicators.macd.signal) {
      buyScore += 1.5;
    } else if (indicators.macd.histogram < 0 && indicators.macd.value < indicators.macd.signal) {
      sellScore += 1.5;
    }

    // Bollinger Bands signal
    if (currentPrice < indicators.bollingerBands.lower) {
      buyScore += 1;
    } else if (currentPrice > indicators.bollingerBands.upper) {
      sellScore += 1;
    }

    // Determine final signal
    let signal: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
    let score = 0;

    if (buyScore > sellScore) {
      signal = 'BUY';
      score = buyScore / (buyScore + sellScore + 1);
    } else if (sellScore > buyScore) {
      signal = 'SELL';
      score = sellScore / (buyScore + sellScore + 1);
    } else {
      score = 0.5;
    }

    return { signal, score };
  }
}

export default TechnicalAnalysis;
