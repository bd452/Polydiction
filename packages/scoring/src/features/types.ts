/**
 * Common types for feature computation
 */

/**
 * Trade data needed for feature computation
 */
export interface TradeInput {
  id: string;
  size: number;
  price: number;
  side: "BUY" | "SELL";
  timestamp: Date;
  maker: string;
  taker: string;
}

/**
 * Market state data needed for feature computation
 */
export interface MarketInput {
  id: string;
  endDate: Date | null;
  bestBid: number;
  bestAsk: number;
  bidDepth: number;
  askDepth: number;
}

/**
 * Historical context for feature computation
 */
export interface ContextInput {
  /** Median trade size for this market (last 7 days) */
  medianTradeSize: number;
  /** Wallet's current position in this market */
  walletPosition: number;
  /** Wallet's position 1 hour ago */
  walletPositionHourAgo: number;
  /** Number of trades by this wallet in last hour */
  walletTradesLastHour: number;
  /** Total market liquidity (bid + ask depth) */
  totalLiquidity: number;
  /** Wallet age in days (null if unknown) */
  walletAgeDays: number | null;
  /** USD value of the trade */
  tradeUsdValue: number;
}

/**
 * Complete input for feature computation
 */
export interface FeatureInput {
  trade: TradeInput;
  market: MarketInput;
  context: ContextInput;
}

/**
 * Result from a feature computation
 */
export interface FeatureResult {
  /** Feature name */
  name: string;
  /** Normalized score (0-1) */
  score: number;
  /** Raw value before normalization (for debugging) */
  rawValue: number;
  /** Human-readable description when score is high */
  description: string;
}

/**
 * Feature function signature
 */
export type FeatureFunction = (input: FeatureInput) => FeatureResult;
