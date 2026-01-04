/**
 * Scoring configuration
 * See SUMMARY.md for rationale behind these values
 */

/**
 * Feature weights for anomaly scoring
 * Weights sum to 1.0
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
 * Default sensitivity value
 * Range: 0.0 (most permissive) to 1.0 (most strict)
 * Lower = more alerts (higher recall)
 * Higher = fewer alerts (higher precision)
 */
export const DEFAULT_SENSITIVITY = 0.3;

/**
 * Calculate alert threshold based on sensitivity
 * At sensitivity 0.0: threshold = 0.25 (very permissive)
 * At sensitivity 0.3: threshold = 0.40 (default)
 * At sensitivity 1.0: threshold = 0.75 (very strict)
 */
export function calculateThreshold(sensitivity: number): number {
  return 0.25 + sensitivity * 0.5;
}

/**
 * Must-flag conditions that bypass scoring
 * Any of these will trigger an alert regardless of score
 */
export const MUST_FLAG_CONDITIONS = {
  /** Single trade exceeding this USD value */
  singleTradeUsd: 25_000,
  /** Position accumulated within 1 hour exceeding this USD value */
  hourlyAccumulationUsd: 50_000,
  /** New wallet (< 7 days) trade exceeding this USD value */
  newWalletTradeUsd: 10_000,
  /** Position exceeding this percentage of market liquidity */
  liquidityPercentage: 0.05,
  /** Wallet age in days to be considered "new" */
  newWalletAgeDays: 7,
} as const;
