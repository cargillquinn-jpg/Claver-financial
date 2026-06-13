import dotenv from 'dotenv';
import * as fs from 'fs';

// Load environment variables
dotenv.config();

interface BinanceConfig {
  apiKey: string;
  apiSecret: string;
}

interface TradingConfig {
  pair: string;
  positionSize: number;
  liveTrading: boolean;
  stopLossPercent: number;
  takeProfitPercent: number;
  maxPositions: number;
}

interface MLConfig {
  lookbackPeriod: number;
  confidenceThreshold: number;
  modelCheckpointPath: string;
}

interface NewsConfig {
  apiKey: string;
  updateIntervalMinutes: number;
}

interface LoggingConfig {
  level: string;
  filePath: string;
}

interface Config {
  binance: BinanceConfig;
  trading: TradingConfig;
  ml: MLConfig;
  news: NewsConfig;
  logging: LoggingConfig;
}

// Validate required environment variables
function validateConfig(): void {
  const requiredVars = ['BINANCE_API_KEY', 'BINANCE_API_SECRET'];
  const missing = requiredVars.filter(v => !process.env[v]);
  
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}\n` +
      `Please copy .env.example to .env and fill in your credentials.`
    );
  }
}

// Create logs directory if it doesn't exist
function ensureLogsDirectory(): void {
  const logsDir = './logs';
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }
}

const config: Config = {
  binance: {
    apiKey: process.env.BINANCE_API_KEY || '',
    apiSecret: process.env.BINANCE_API_SECRET || '',
  },
  trading: {
    pair: process.env.TRADING_PAIR || 'BTCUSDT',
    positionSize: parseFloat(process.env.POSITION_SIZE || '100'),
    liveTrading: process.env.LIVE_TRADING === 'true',
    stopLossPercent: parseFloat(process.env.STOP_LOSS_PERCENT || '0.05'),
    takeProfitPercent: parseFloat(process.env.TAKE_PROFIT_PERCENT || '0.10'),
    maxPositions: parseInt(process.env.MAX_POSITIONS || '1'),
  },
  ml: {
    lookbackPeriod: parseInt(process.env.LOOKBACK_PERIOD || '100'),
    confidenceThreshold: parseFloat(process.env.ML_CONFIDENCE_THRESHOLD || '0.65'),
    modelCheckpointPath: process.env.MODEL_CHECKPOINT_PATH || './models/trading_model.h5',
  },
  news: {
    apiKey: process.env.NEWS_API_KEY || '',
    updateIntervalMinutes: parseInt(process.env.NEWS_UPDATE_INTERVAL || '30'),
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    filePath: process.env.LOG_FILE || './logs/trading.log',
  },
};

// Initialize
ensureLogsDirectory();
validateConfig();

export default config;
