/**
 * Feature computation modules
 *
 * This module exports all feature computation functions and utilities
 * for anomaly detection scoring.
 */

// Types
export * from "./types";

// Feature functions
export { computeTradeSizeVsMedian, TRADE_SIZE_WEIGHT } from "./trade-size";
export { computeTradeSizeVsDepth, DEPTH_RATIO_WEIGHT } from "./depth-ratio";
export { computeAggressiveness, AGGRESSIVENESS_WEIGHT } from "./aggressiveness";
export { computeWalletBurst, WALLET_BURST_WEIGHT } from "./wallet-burst";
export {
  computePositionConcentration,
  computeRampSpeed,
  POSITION_CONCENTRATION_WEIGHT,
  RAMP_SPEED_WEIGHT,
} from "./position";
export {
  computeTimingVsMarketEnd,
  computeWalletFreshness,
  computeDollarValue,
  WALLET_FRESHNESS_WEIGHT,
  DOLLAR_VALUE_WEIGHT,
} from "./timing";

// Import feature weights from config (single source of truth)
import { FEATURE_WEIGHTS } from "../config";

export type FeatureName = keyof typeof FEATURE_WEIGHTS;

import type { FeatureInput, FeatureResult } from "./types";
import { computeTradeSizeVsMedian } from "./trade-size";
import { computeTradeSizeVsDepth } from "./depth-ratio";
import { computeAggressiveness } from "./aggressiveness";
import { computeWalletBurst } from "./wallet-burst";
import { computePositionConcentration, computeRampSpeed } from "./position";
import { computeWalletFreshness, computeDollarValue } from "./timing";

/**
 * Compute all features for a given input
 */
export function computeAllFeatures(input: FeatureInput): Record<FeatureName, FeatureResult> {
  return {
    tradeSizeVsMedian: computeTradeSizeVsMedian(input),
    tradeSizeVsDepth: computeTradeSizeVsDepth(input),
    aggressiveness: computeAggressiveness(input),
    walletBurst: computeWalletBurst(input),
    positionConcentration: computePositionConcentration(input),
    rampSpeed: computeRampSpeed(input),
    walletFreshness: computeWalletFreshness(input),
    dollarValue: computeDollarValue(input),
  };
}

/**
 * Compute weighted score from feature results
 */
export function computeWeightedScore(features: Record<FeatureName, FeatureResult>): number {
  let score = 0;

  for (const [name, weight] of Object.entries(FEATURE_WEIGHTS)) {
    const feature = features[name as FeatureName];
    score += feature.score * weight;
  }

  return score;
}
