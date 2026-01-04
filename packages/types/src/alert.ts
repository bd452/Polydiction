import type { DecimalString, MarketId, Timestamp, TradeId, UUID, WalletAddress } from "./common";

/**
 * Individual feature scores that contributed to an alert
 */
export interface FeatureScores {
  tradeSizeVsMedian: number;
  tradeSizeVsDepth: number;
  aggressiveness: number;
  walletBurst: number;
  positionConcentration: number;
  rampSpeed: number;
  walletFreshness: number;
  dollarValue: number;
}

/**
 * Reasons why an alert was triggered
 */
export interface AlertReasons {
  /** Primary reason for the alert */
  primary: string;
  /** All contributing factors */
  factors: string[];
  /** Whether this was a must-flag condition */
  mustFlag: boolean;
  /** Which must-flag condition was triggered, if any */
  mustFlagCondition?: string;
}

/**
 * Market state at the time of alert
 */
export interface AlertMarketState {
  tokenPrice: DecimalString;
  bestBid: DecimalString;
  bestAsk: DecimalString;
  spread: DecimalString;
  bidDepth: DecimalString;
  askDepth: DecimalString;
}

/**
 * An anomaly alert for a suspicious trade
 */
export interface Alert {
  id: UUID;
  marketId: MarketId;
  tradeId: TradeId;
  wallet: WalletAddress;
  score: DecimalString;
  reasons: AlertReasons;
  features: FeatureScores;
  marketState: AlertMarketState;
  createdAt: Timestamp;
}

/**
 * Alert with related market and trade data
 */
export interface AlertWithContext extends Alert {
  marketQuestion: string;
  marketSlug: string;
  tradeSize: DecimalString;
  tradePrice: DecimalString;
  tradeSide: "BUY" | "SELL";
}

/**
 * Alert filter options for querying
 */
export interface AlertFilters {
  minScore?: number;
  maxScore?: number;
  marketId?: MarketId;
  wallet?: WalletAddress;
  startTime?: Timestamp;
  endTime?: Timestamp;
}
