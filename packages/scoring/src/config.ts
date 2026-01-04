/**
 * Scoring configuration
 * These values control anomaly detection sensitivity
 */

/**
 * Feature weights for scoring
 * Must sum to 1.0
 */
export const FEATURE_WEIGHTS = {
  tradeSizeVsMedian: 0.15,
  tradeSizeVsDepth: 0.15,
  aggressiveness: 0.2,
  walletBurst: 0.15,
  positionConcentration: 0.1,
  rampSpeed: 0.1,
  walletFreshness: 0.1,
  dollarValue: 0.05,
} as const;

/**
 * Default alert sensitivity
 * Range: 0.0 (most permissive) to 1.0 (most strict)
 * Lower values = more alerts, higher recall, more false positives
 * Higher values = fewer alerts, higher precision, may miss signals
 */
export const DEFAULT_ALERT_SENSITIVITY = 0.3;

/**
 * Calculate alert threshold based on sensitivity
 */
export function getAlertThreshold(sensitivity: number = DEFAULT_ALERT_SENSITIVITY): number {
  // Base threshold adjusted by sensitivity
  // At sensitivity 0.0: threshold = 0.25 (very permissive)
  // At sensitivity 0.3: threshold = 0.40
  // At sensitivity 1.0: threshold = 0.75 (very strict)
  return 0.25 + sensitivity * 0.5;
}

/**
 * Must-flag thresholds (bypass scoring, always alert)
 */
export const MUST_FLAG_THRESHOLDS = {
  /** Single trade USD value */
  singleTradeUsd: 25_000,
  /** Position accumulated in 1 hour */
  hourlyAccumulationUsd: 50_000,
  /** New wallet (< 7 days) trade threshold */
  newWalletTradeUsd: 10_000,
  /** New wallet age in days */
  newWalletAgeDays: 7,
  /** Position as percentage of market liquidity */
  positionLiquidityPercent: 5,
} as const;

/**
 * Validate that feature weights sum to 1
 */
export function validateWeights(): boolean {
  const sum = Object.values(FEATURE_WEIGHTS).reduce((a, b) => a + b, 0);
  return Math.abs(sum - 1.0) < 0.001;
}
