import logger from '../utils/logger';
import config from '../config/config';
import TechnicalAnalysis from '../ml/technicalIndicators';
import SentimentAnalysis from '../ml/sentimentAnalysis';
import NeuralNetworkModel from '../ml/neuralNetwork';

interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface TradingDecision {
  action: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  reasoning: string;
  technicalSignal: 'BUY' | 'SELL' | 'HOLD';
  mlSignal: 'BUY' | 'SELL' | 'HOLD';
  sentimentScore: number;
}

class TradingStrategy {
  private technicalAnalysis: typeof TechnicalAnalysis;
  private sentimentAnalysis: SentimentAnalysis;
  private neuralNetwork: NeuralNetworkModel;
  private lastDecision: TradingDecision | null = null;

  constructor() {
    this.technicalAnalysis = TechnicalAnalysis;
    this.sentimentAnalysis = new SentimentAnalysis();
    this.neuralNetwork = new NeuralNetworkModel();
  }

  /**
   * Generate a trading decision based on multiple factors
   */
  async generateTradingDecision(
    candles: Candle[],
    currentPrice: number,
    pair: string
  ): Promise<TradingDecision> {
    try {
      // Calculate technical indicators
      const technicalIndicators = this.technicalAnalysis.calculateIndicators(candles);
      
      // Get technical signal
      const { signal: technicalSignal, score: technicalScore } = 
        this.technicalAnalysis.generateSignal(technicalIndicators, currentPrice);

      // Get ML signal
      const features = this.neuralNetwork.prepareFeatures(candles, technicalIndicators);
      const { action: mlSignal, confidence: mlConfidence } = this.neuralNetwork.predict(features);

      // Get sentiment signal
      const sentiment = await this.sentimentAnalysis.calculateNewsSentiment(pair);
      const sentimentScore = sentiment.score;

      // Combine signals with weighted voting
      const decision = this.combineSignals(
        technicalSignal,
        technicalScore,
        mlSignal,
        mlConfidence,
        sentimentScore
      );

      // Add reasoning
      const reasoning = this.generateReasoning(
        technicalSignal,
        mlSignal,
        sentimentScore,
        technicalIndicators,
        currentPrice
      );

      const tradingDecision: TradingDecision = {
        action: decision.action,
        confidence: decision.confidence,
        reasoning,
        technicalSignal,
        mlSignal,
        sentimentScore,
      };

      this.lastDecision = tradingDecision;

      logger.info(
        `Trading Decision: ${tradingDecision.action} ` +
        `(Confidence: ${(tradingDecision.confidence * 100).toFixed(2)}%) - ${reasoning}`
      );

      return tradingDecision;
    } catch (error) {
      logger.error(`Error generating trading decision: ${error}`);
      return {
        action: 'HOLD',
        confidence: 0,
        reasoning: 'Error in decision generation',
        technicalSignal: 'HOLD',
        mlSignal: 'HOLD',
        sentimentScore: 0,
      };
    }
  }

  /**
   * Combine multiple signals into a final decision
   */
  private combineSignals(
    technicalSignal: string,
    technicalScore: number,
    mlSignal: string,
    mlConfidence: number,
    sentimentScore: number
  ): { action: 'BUY' | 'SELL' | 'HOLD'; confidence: number } {
    // Weight the signals
    const technicalWeight = 0.35;
    const mlWeight = 0.50;
    const sentimentWeight = 0.15;

    // Convert signals to numeric scores
    const technicalValue = technicalSignal === 'BUY' ? 1 : technicalSignal === 'SELL' ? -1 : 0;
    const mlValue = mlSignal === 'BUY' ? 1 : mlSignal === 'SELL' ? -1 : 0;
    const sentimentValue = Math.sign(sentimentScore);

    // Calculate weighted score
    const weightedScore =
      technicalValue * technicalWeight +
      mlValue * mlConfidence * mlWeight +
      sentimentValue * sentimentWeight;

    // Determine final action and confidence
    let action: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
    let confidence = Math.abs(weightedScore);

    // Apply confidence threshold
    if (confidence < config.ml.confidenceThreshold) {
      action = 'HOLD';
      confidence = 0;
    } else if (weightedScore > 0) {
      action = 'BUY';
    } else if (weightedScore < 0) {
      action = 'SELL';
    }

    return { action, confidence };
  }

  /**
   * Generate human-readable reasoning for the decision
   */
  private generateReasoning(
    technicalSignal: string,
    mlSignal: string,
    sentimentScore: number,
    technicalIndicators: any,
    currentPrice: number
  ): string {
    const reasons: string[] = [];

    // Technical analysis reasoning
    if (technicalSignal === 'BUY') {
      reasons.push('Technical indicators show uptrend');
    } else if (technicalSignal === 'SELL') {
      reasons.push('Technical indicators show downtrend');
    }

    // ML reasoning
    if (mlSignal === 'BUY') {
      reasons.push('ML model predicts price increase');
    } else if (mlSignal === 'SELL') {
      reasons.push('ML model predicts price decrease');
    }

    // Sentiment reasoning
    if (sentimentScore > 0.2) {
      reasons.push('Positive news sentiment');
    } else if (sentimentScore < -0.2) {
      reasons.push('Negative news sentiment');
    }

    // RSI reasoning
    if (technicalIndicators.rsi < 30) {
      reasons.push('RSI oversold');
    } else if (technicalIndicators.rsi > 70) {
      reasons.push('RSI overbought');
    }

    return reasons.length > 0 ? reasons.join('; ') : 'Neutral market conditions';
  }

  /**
   * Check if we should exit an existing position
   */
  shouldExitPosition(
    entryPrice: number,
    currentPrice: number,
    positionType: 'LONG' | 'SHORT'
  ): { shouldExit: boolean; reason: string } {
    const priceChange = (currentPrice - entryPrice) / entryPrice;

    // Check stop loss
    if (
      (positionType === 'LONG' && priceChange < -config.trading.stopLossPercent) ||
      (positionType === 'SHORT' && priceChange > config.trading.stopLossPercent)
    ) {
      return {
        shouldExit: true,
        reason: `Stop loss triggered (${(priceChange * 100).toFixed(2)}%)`,
      };
    }

    // Check take profit
    if (
      (positionType === 'LONG' && priceChange > config.trading.takeProfitPercent) ||
      (positionType === 'SHORT' && priceChange < -config.trading.takeProfitPercent)
    ) {
      return {
        shouldExit: true,
        reason: `Take profit reached (${(priceChange * 100).toFixed(2)}%)`,
      };
    }

    return { shouldExit: false, reason: 'Position within limits' };
  }

  /**
   * Get the last trading decision
   */
  getLastDecision(): TradingDecision | null {
    return this.lastDecision;
  }
}

export default TradingStrategy;
