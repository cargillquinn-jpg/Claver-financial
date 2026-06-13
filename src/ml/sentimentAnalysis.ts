import axios from 'axios';
import Sentiment from 'sentiment';
import config from '../config/config';
import logger from '../utils/logger';

interface NewsArticle {
  title: string;
  description: string;
  url: string;
  publishedAt: string;
  sentiment: number;
}

interface SentimentScore {
  score: number; // -1 to 1
  magnitude: number; // 0 to 1
  articles: NewsArticle[];
}

class SentimentAnalysis {
  private sentimentAnalyzer: Sentiment;
  private lastNewsUpdate: number = 0;
  private cachedSentiment: SentimentScore | null = null;

  constructor() {
    this.sentimentAnalyzer = new Sentiment();
  }

  /**
   * Fetch crypto news related to the trading pair
   */
  async fetchCryptoNews(pair: string): Promise<NewsArticle[]> {
    try {
      // Determine the cryptocurrency from the pair (e.g., BTCUSDT -> Bitcoin)
      const cryptoName = this.extractCryptoName(pair);
      
      // Use NewsAPI or similar service (requires API key)
      // For now, we'll use a placeholder - you'll need to implement with actual news API
      logger.info(`Fetching news for ${cryptoName}...`);

      // Example: Using NewsAPI (you need to add NEWS_API_KEY to .env)
      if (!config.news.apiKey) {
        logger.warn('NEWS_API_KEY not configured. Skipping news sentiment analysis.');
        return [];
      }

      const response = await axios.get('https://newsapi.org/v2/everything', {
        params: {
          q: `${cryptoName} cryptocurrency`,
          sortBy: 'publishedAt',
          language: 'en',
          pageSize: 10,
          apiKey: config.news.apiKey,
        },
      });

      const articles: NewsArticle[] = response.data.articles.map((article: any) => ({
        title: article.title,
        description: article.description || '',
        url: article.url,
        publishedAt: article.publishedAt,
        sentiment: 0, // Will be calculated below
      }));

      logger.info(`Fetched ${articles.length} news articles for ${cryptoName}`);
      return articles;
    } catch (error) {
      logger.error(`Error fetching crypto news: ${error}`);
      return [];
    }
  }

  /**
   * Analyze sentiment of text using NLP
   */
  analyzeSentiment(text: string): { score: number; comparative: number } {
    try {
      const result = this.sentimentAnalyzer.analyze(text);
      return {
        score: result.score, // -N to +N (sum of sentiment values)
        comparative: result.comparative, // -1 to 1 (normalized)
      };
    } catch (error) {
      logger.error(`Error analyzing sentiment: ${error}`);
      return { score: 0, comparative: 0 };
    }
  }

  /**
   * Calculate overall sentiment score from news articles
   */
  async calculateNewsSentiment(pair: string): Promise<SentimentScore> {
    try {
      const now = Date.now();
      
      // Use cached sentiment if it's recent (within configured interval)
      if (
        this.cachedSentiment &&
        now - this.lastNewsUpdate < config.news.updateIntervalMinutes * 60 * 1000
      ) {
        return this.cachedSentiment;
      }

      const articles = await this.fetchCryptoNews(pair);
      
      if (articles.length === 0) {
        return {
          score: 0,
          magnitude: 0,
          articles: [],
        };
      }

      // Analyze sentiment for each article
      let totalScore = 0;
      articles.forEach((article) => {
        const textToAnalyze = `${article.title} ${article.description}`;
        const sentiment = this.analyzeSentiment(textToAnalyze);
        article.sentiment = sentiment.comparative;
        totalScore += sentiment.comparative;
      });

      // Calculate average sentiment
      const averageSentiment = totalScore / articles.length;
      
      // Normalize to -1 to 1 range
      const normalizedScore = Math.max(-1, Math.min(1, averageSentiment));

      const result: SentimentScore = {
        score: normalizedScore,
        magnitude: Math.abs(normalizedScore),
        articles: articles.sort((a, b) => 
          new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
        ),
      };

      this.cachedSentiment = result;
      this.lastNewsUpdate = now;

      logger.info(`News sentiment calculated: ${normalizedScore.toFixed(3)}`);
      return result;
    } catch (error) {
      logger.error(`Error calculating news sentiment: ${error}`);
      return {
        score: 0,
        magnitude: 0,
        articles: [],
      };
    }
  }

  /**
   * Extract cryptocurrency name from trading pair
   */
  private extractCryptoName(pair: string): string {
    const cryptoMap: { [key: string]: string } = {
      'BTC': 'Bitcoin',
      'ETH': 'Ethereum',
      'ADA': 'Cardano',
      'XRP': 'Ripple',
      'SOL': 'Solana',
      'DOGE': 'Dogecoin',
      'DOT': 'Polkadot',
      'MATIC': 'Polygon',
    };

    const cryptoCode = pair.replace('USDT', '').replace('USDC', '').replace('BUSD', '');
    return cryptoMap[cryptoCode] || cryptoCode;
  }
}

export default SentimentAnalysis;
