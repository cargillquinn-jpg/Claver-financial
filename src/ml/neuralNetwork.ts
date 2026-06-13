import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-node';
import logger from '../utils/logger';

interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface TrainingData {
  features: number[][];
  labels: number[];
}

class NeuralNetworkModel {
  private model: tf.LayersModel | null = null;
  private featureScaler = { min: 0, max: 100 };

  /**
   * Prepare features from candles and indicators
   */
  prepareFeatures(candles: Candle[], technicalIndicators: any): number[] {
    const currentCandle = candles[candles.length - 1];
    
    // Normalize price features
    const closePrices = candles.map(c => c.close);
    const minPrice = Math.min(...closePrices);
    const maxPrice = Math.max(...closePrices);
    const priceRange = maxPrice - minPrice || 1;

    const features = [
      // Price action (normalized)
      (currentCandle.close - minPrice) / priceRange,
      (currentCandle.open - minPrice) / priceRange,
      (currentCandle.high - minPrice) / priceRange,
      (currentCandle.low - minPrice) / priceRange,
      currentCandle.volume / (Math.max(...candles.map(c => c.volume)) || 1),
      
      // Volume trend
      (candles[candles.length - 1].volume - candles[candles.length - 2].volume) / 
        (candles[candles.length - 2].volume || 1),
      
      // Technical indicators (normalized to 0-1)
      technicalIndicators.rsi / 100,
      (technicalIndicators.sma20 - minPrice) / priceRange,
      (technicalIndicators.sma50 - minPrice) / priceRange,
      (technicalIndicators.macd.value - (technicalIndicators.macd.signal || 0)) / 
        (Math.abs(technicalIndicators.macd.signal) || 1),
      (currentCandle.close - technicalIndicators.bollingerBands.lower) / 
        (technicalIndicators.bollingerBands.upper - technicalIndicators.bollingerBands.lower || 1),
    ];

    return features;
  }

  /**
   * Create a simple LSTM-based neural network for price prediction
   */
  buildModel(inputShape: number): void {
    try {
      this.model = tf.sequential({
        layers: [
          tf.layers.dense({
            inputShape: [inputShape],
            units: 64,
            activation: 'relu',
          }),
          tf.layers.dropout({ rate: 0.2 }),
          tf.layers.dense({
            units: 32,
            activation: 'relu',
          }),
          tf.layers.dropout({ rate: 0.2 }),
          tf.layers.dense({
            units: 16,
            activation: 'relu',
          }),
          tf.layers.dense({
            units: 3, // Output: [BUY_prob, HOLD_prob, SELL_prob]
            activation: 'softmax',
          }),
        ],
      });

      this.model.compile({
        optimizer: tf.train.adam(0.001),
        loss: 'categoricalCrossentropy',
        metrics: ['accuracy'],
      });

      logger.info('Neural network model built successfully');
    } catch (error) {
      logger.error(`Error building model: ${error}`);
      throw error;
    }
  }

  /**
   * Prepare training data from historical candles
   */
  prepareTrainingData(historicalCandles: Candle[][], technicalIndicators: any[]): TrainingData {
    const features: number[][] = [];
    const labels: number[] = [];

    // Create training samples
    for (let i = 0; i < historicalCandles.length - 1; i++) {
      const currentCandles = historicalCandles[i];
      const nextCandles = historicalCandles[i + 1];
      
      const currentIndicators = technicalIndicators[i];
      const nextPrice = nextCandles[nextCandles.length - 1].close;
      const currentPrice = currentCandles[currentCandles.length - 1].close;

      // Determine label: 0=BUY, 1=HOLD, 2=SELL
      const priceChange = (nextPrice - currentPrice) / currentPrice;
      let label = 1; // HOLD
      
      if (priceChange > 0.02) { // 2% gain = BUY signal was good
        label = 0;
      } else if (priceChange < -0.02) { // 2% loss = SELL signal was good
        label = 2;
      }

      const featureVector = this.prepareFeatures(currentCandles, currentIndicators);
      features.push(featureVector);
      labels.push(label);
    }

    return { features, labels };
  }

  /**
   * Train the model on historical data
   */
  async trainModel(trainingData: TrainingData, epochs: number = 50): Promise<void> {
    if (!this.model) {
      throw new Error('Model not built. Call buildModel first.');
    }

    try {
      const xs = tf.tensor2d(trainingData.features);
      const ys = tf.tensor2d(trainingData.labels, [trainingData.labels.length, 1]);

      // Convert labels to one-hot encoding
      const oneHotLabels = tf.oneHot(tf.tensor1d(trainingData.labels, 'int32'), 3);

      logger.info(`Training model on ${trainingData.features.length} samples...`);

      await this.model.fit(xs, oneHotLabels, {
        epochs,
        batchSize: 32,
        shuffle: true,
        verbose: 0,
        callbacks: {
          onEpochEnd: (epoch, logs) => {
            if ((epoch + 1) % 10 === 0) {
              logger.info(`Epoch ${epoch + 1}/${epochs} - Loss: ${logs?.loss?.toFixed(4)}`);
            }
          },
        },
      });

      xs.dispose();
      ys.dispose();
      oneHotLabels.dispose();

      logger.info('Model training completed');
    } catch (error) {
      logger.error(`Error training model: ${error}`);
      throw error;
    }
  }

  /**
   * Make a prediction with the neural network
   */
  predict(features: number[]): { action: 'BUY' | 'HOLD' | 'SELL'; confidence: number } {
    if (!this.model) {
      throw new Error('Model not built. Call buildModel first.');
    }

    try {
      const inputTensor = tf.tensor2d([features]);
      const predictions = this.model.predict(inputTensor) as tf.Tensor;
      const predictionData = predictions.dataSync();

      const actions = ['BUY', 'HOLD', 'SELL'];
      let maxProb = 0;
      let bestAction = 'HOLD';

      for (let i = 0; i < 3; i++) {
        if (predictionData[i] > maxProb) {
          maxProb = predictionData[i];
          bestAction = actions[i] as any;
        }
      }

      inputTensor.dispose();
      predictions.dispose();

      logger.debug(`Model prediction: ${bestAction} (confidence: ${(maxProb * 100).toFixed(2)}%)`);

      return {
        action: bestAction as 'BUY' | 'HOLD' | 'SELL',
        confidence: maxProb,
      };
    } catch (error) {
      logger.error(`Error making prediction: ${error}`);
      return { action: 'HOLD', confidence: 0 };
    }
  }

  /**
   * Save the trained model
   */
  async saveModel(path: string): Promise<void> {
    if (!this.model) {
      throw new Error('Model not built. Call buildModel first.');
    }

    try {
      await this.model.save(`file://${path}`);
      logger.info(`Model saved to ${path}`);
    } catch (error) {
      logger.error(`Error saving model: ${error}`);
      throw error;
    }
  }

  /**
   * Load a previously trained model
   */
  async loadModel(path: string): Promise<void> {
    try {
      this.model = await tf.loadLayersModel(`file://${path}/model.json`);
      logger.info(`Model loaded from ${path}`);
    } catch (error) {
      logger.error(`Error loading model: ${error}`);
      throw error;
    }
  }
}

export default NeuralNetworkModel;
