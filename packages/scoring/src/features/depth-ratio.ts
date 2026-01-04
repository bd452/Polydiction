/**
 * Trade Size vs Available Depth Feature
 *
 * Measures how much of the orderbook liquidity a trade consumes.
 * Trades that consume significant depth indicate urgency or informed trading.
 */

import type { FeatureInput, FeatureResult } from "./types";

/**
 * Computes trade size vs available depth feature
 *
 * @param input - Feature computation input
 * @returns Feature result with normalized score (0-1)
 */
export function computeTradeSizeVsDepth(input: FeatureInput): FeatureResult {
  const { trade, market } = input;

  // Get relevant depth based on trade side
  // BUY orders consume ask-side liquidity, SELL orders consume bid-side
  const relevantDepth = trade.side === "BUY" ? market.askDepth : market.bidDepth;

  // Calculate ratio of trade size to available depth
  const rawValue = relevantDepth > 0 ? trade.size / relevantDepth : trade.size > 0 ? 1 : 0;

  // Score is capped at 1 (trade can't consume more than 100% of depth)
  const score = Math.min(rawValue, 1);

  return {
    name: "tradeSizeVsDepth",
    score,
    rawValue,
    description: "Trade consumes substantial orderbook depth",
  };
}

/**
 * Weight for this feature in the overall score
 */
export const DEPTH_RATIO_WEIGHT = 0.15;
