import type { FeatureScores } from "@polydiction/types";

/**
 * Input data required for feature extraction
 */
export interface ScoringInput {
  /** The trade being evaluated */
  trade: {
    id: string;
    size: number;
    price: number;
    side: "BUY" | "SELL";
    timestamp: Date;
    maker: string;
    taker: string;
  };

  /** Current market state */
  market: {
    id: string;
    endDate: Date | null;
    bestBid: number;
    bestAsk: number;
    bidDepth: number;
    askDepth: number;
  };

  /** Historical context */
  context: {
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
  };
}

/**
 * Result of scoring a trade
 */
export interface ScoringResult {
  /** Overall anomaly score (0-1) */
  score: number;
  /** Individual feature scores */
  features: FeatureScores;
  /** Whether this should be flagged as an alert */
  shouldAlert: boolean;
  /** Reasons for alerting */
  reasons: {
    primary: string;
    factors: string[];
    mustFlag: boolean;
    mustFlagCondition?: string;
  };
}
