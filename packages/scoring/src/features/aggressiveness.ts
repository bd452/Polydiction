/**
 * Trade Aggressiveness Feature
 *
 * Measures how aggressively a trade was executed.
 * Paying the full spread (crossing to hit the opposite side) indicates
 * urgency and willingness to pay for immediate execution.
 */

import type { FeatureInput, FeatureResult } from "./types";

/**
 * Computes trade aggressiveness feature
 *
 * @param input - Feature computation input
 * @returns Feature result with normalized score (0-1)
 */
export function computeAggressiveness(input: FeatureInput): FeatureResult {
  const { trade, market } = input;

  const spread = market.bestAsk - market.bestBid;
  let score = 0;
  let rawValue = 0;

  if (spread > 0 && market.bestBid > 0 && market.bestAsk > 0) {
    if (trade.side === "BUY") {
      if (trade.price >= market.bestAsk) {
        // Paid full ask or above - very aggressive
        const overpay = trade.price - market.bestAsk;
        rawValue = 1 + overpay / spread;
        score = 0.8 + 0.2 * Math.min(overpay / spread, 1);
      } else if (trade.price > market.bestBid) {
        // Somewhere in the spread - moderate aggressiveness
        const distanceFromBid = trade.price - market.bestBid;
        rawValue = distanceFromBid / spread;
        score = (distanceFromBid / spread) * 0.7;
      }
      // Below or at bid - not aggressive (0)
    } else {
      // SELL
      if (trade.price <= market.bestBid) {
        // Hit full bid or below - very aggressive
        const underpay = market.bestBid - trade.price;
        rawValue = 1 + underpay / spread;
        score = 0.8 + 0.2 * Math.min(underpay / spread, 1);
      } else if (trade.price < market.bestAsk) {
        // Somewhere in the spread - moderate aggressiveness
        const distanceFromAsk = market.bestAsk - trade.price;
        rawValue = distanceFromAsk / spread;
        score = (distanceFromAsk / spread) * 0.7;
      }
      // At or above ask - not aggressive (0)
    }
  }

  return {
    name: "aggressiveness",
    score: Math.min(score, 1),
    rawValue,
    description: "Aggressive execution (crossing spread)",
  };
}

/**
 * Weight for this feature in the overall score
 */
export const AGGRESSIVENESS_WEIGHT = 0.2;
