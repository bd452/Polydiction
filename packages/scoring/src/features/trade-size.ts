/**
 * Trade Size vs Market Median Feature
 *
 * Measures how large a trade is relative to typical trades in the market.
 * Large trades relative to the median may indicate informed trading.
 */

import type { FeatureInput, FeatureResult } from "./types";

/**
 * Normalize a value to 0-1 range using sigmoid-like scaling
 * Values at median = 0.5, 2x median ≈ 0.73, 5x median ≈ 0.91
 */
function normalize(value: number, median: number): number {
  if (median <= 0) return 0;
  const ratio = value / median;
  return 1 - 1 / (1 + ratio);
}

/**
 * Computes trade size vs market median feature
 *
 * @param input - Feature computation input
 * @returns Feature result with normalized score (0-1)
 */
export function computeTradeSizeVsMedian(input: FeatureInput): FeatureResult {
  const { trade, context } = input;

  // Calculate ratio
  const rawValue =
    context.medianTradeSize > 0 ? trade.size / context.medianTradeSize : trade.size > 0 ? 10 : 0;

  // Normalize to 0-1 scale
  const score = normalize(trade.size, context.medianTradeSize);

  return {
    name: "tradeSizeVsMedian",
    score,
    rawValue,
    description: "Trade significantly larger than market median",
  };
}

/**
 * Weight for this feature in the overall score
 */
export const TRADE_SIZE_WEIGHT = 0.15;
