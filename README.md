# Claver Financial AI Trading Bot

An autonomous cryptocurrency trading bot built with Node.js and TypeScript that uses machine learning, technical analysis, and news sentiment to make intelligent trading decisions on Binance.

## 🚀 Features

- **Machine Learning Trading**: Neural network-based price prediction and pattern recognition
- **Technical Analysis**: SMA, RSI, MACD, Bollinger Bands, and ATR calculations
- **News Sentiment Analysis**: Real-time cryptocurrency news sentiment tracking
- **Risk Management**: Stop-loss, take-profit, and position sizing controls
- **Portfolio Management**: Track positions, P&L, and performance metrics
- **Binance Integration**: Direct connection to Binance API for live trading
- **Paper Trading**: Test strategies without real money
- **Comprehensive Logging**: Detailed trading activity and decision logs

## 📋 Prerequisites

- Node.js 16+ and npm
- Binance account (for API keys)
- NewsAPI key (optional, for sentiment analysis)

## 🔧 Installation

1. Clone the repository:
```bash
git clone https://github.com/cargillquinn-jpg/Claver-financial.git
cd Claver-financial
```

2. Install dependencies:
```bash
npm install
```

3. Copy the environment template and add your credentials:
```bash
cp .env.example .env
```

4. Edit `.env` with your configuration:
```env
# Binance API credentials (get from https://www.binance.com/en/account/api-management)
BINANCE_API_KEY=your_api_key_here
BINANCE_API_SECRET=your_api_secret_here

# Trading configuration
TRADING_PAIR=BTCUSDT
POSITION_SIZE=100
LIVE_TRADING=false  # Set to true for live trading

# Optional: NewsAPI key for sentiment analysis
NEWS_API_KEY=your_news_api_key_here
```

## ⚙️ Configuration

All configuration is managed in `.env`. Key settings:

| Variable | Default | Description |
|----------|---------|----------|
| `TRADING_PAIR` | BTCUSDT | Cryptocurrency pair to trade |
| `POSITION_SIZE` | 100 | Amount in USDT per position |
| `LIVE_TRADING` | false | Enable live trading (set to true with caution) |
| `ML_CONFIDENCE_THRESHOLD` | 0.65 | Minimum confidence for ML predictions (0-1) |
| `STOP_LOSS_PERCENT` | 0.05 | Stop-loss percentage (5%) |
| `TAKE_PROFIT_PERCENT` | 0.10 | Take-profit percentage (10%) |
| `LOOKBACK_PERIOD` | 100 | Candles for technical analysis |

## 🏃 Running the Bot

### Development Mode
```bash
npm run dev
```

### Production Build
```bash
npm run build
npm start
```

### Train ML Model
```bash
npm run train-model
```

### Backtest Strategy
```bash
npm run backtest
```

## 📊 Project Structure

```
src/
├── config/
│   └── config.ts           # Configuration management
├── exchange/
│   └── binanceClient.ts    # Binance API client
├── ml/
│   ├── technicalIndicators.ts  # Technical analysis (SMA, RSI, MACD)
│   ├── sentimentAnalysis.ts    # News sentiment analysis
│   └── neuralNetwork.ts        # ML model for predictions
├── strategy/
│   └── tradingStrategy.ts  # Combined trading strategy
├── trading/
│   └── portfolio.ts        # Portfolio and position management
├── utils/
│   └── logger.ts           # Logging utility
└── index.ts                # Main entry point
```

## 🤖 How It Works

### 1. Data Collection
- Fetches hourly candle data from Binance
- Retrieves current cryptocurrency prices
- Collects latest news articles

### 2. Analysis
- **Technical Analysis**: Calculates SMA, RSI, MACD, Bollinger Bands
- **ML Model**: Neural network predicts buy/sell/hold signals
- **Sentiment**: Analyzes news articles for positive/negative sentiment

### 3. Decision Making
The bot combines signals with weighted voting:
- Technical Analysis: 35% weight
- ML Model: 50% weight
- News Sentiment: 15% weight

### 4. Execution
- Places market orders on Binance
- Manages positions with stop-loss and take-profit
- Tracks P&L and performance metrics

## ⚠️ Risk Management

**IMPORTANT**: This bot trades with real money. Use caution:

1. **Start with Paper Trading**: Set `LIVE_TRADING=false` to test strategies
2. **Use Small Positions**: Start with low `POSITION_SIZE` values
3. **Monitor Regularly**: Check logs and performance metrics frequently
4. **API Key Security**: Never share your API keys or commit them to git
5. **Restrict Permissions**: Use Binance API restrictions (IP whitelist, trade-only)
6. **Stop Loss**: Configure appropriate `STOP_LOSS_PERCENT` values

## 📈 Performance Metrics

The bot tracks:
- Win rate and average wins/losses
- Profit factor (total wins / total losses)
- Total return and return percentage
- Unrealized and realized P&L
- Trade history and details

## 🔍 Logging

Logs are written to `./logs/trading.log` and console:
- Trade execution details
- Technical indicator calculations
- ML predictions and confidence
- Portfolio state changes
- Errors and warnings

## 🧪 Testing

Run the test suite:
```bash
npm test
```

## 📝 Trading Pair Support

Current implementation supports single pair trading. Supported pairs:
- `BTCUSDT` - Bitcoin (default)
- `ETHUSDT` - Ethereum
- `ADAUSDT` - Cardano
- And any other Binance pair

Change in `.env`: `TRADING_PAIR=ETHUSDT`

## 🚫 Limitations & Future Improvements

### Current Limitations
- Single trading pair only
- Market orders only (no limit orders)
- No shorts on spot account (LONG only)
- Requires Binance account

### Planned Improvements
- Multiple trading pairs
- Advanced order types (limit, stop-loss orders)
- Short selling support
- Portfolio diversification strategies
- Web dashboard for monitoring
- Backtesting system
- Strategy optimization

## 📚 Resources

- [Binance API Documentation](https://binance-docs.github.io/apidocs/)
- [TensorFlow.js Documentation](https://js.tensorflow.org/)
- [NewsAPI Documentation](https://newsapi.org/docs)

## 🤝 Contributing

Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## ⚖️ Disclaimer

This software is provided "as-is" without warranties. Cryptocurrency trading is risky. Use at your own risk. The developers are not responsible for any financial losses.

## 📄 License

MIT License - See LICENSE file for details

## 💬 Support

For issues, questions, or suggestions:
- Create a GitHub issue
- Check existing documentation
- Review the code comments

---

**Last Updated**: 2026-06-13
**Status**: Active Development
