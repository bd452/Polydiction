/**
 * Wallet Burst Behavior Feature
 *
 * Measures how rapidly a wallet is trading.
 * A burst of trades from the same wallet may indicate urgency
 * or informed trading behavior.
 */

import type { FeatureInput, FeatureResult } from "./types";

/**
 * Threshold for maximum expected trades in an hour
 * More than this is considered highly unusual
 */
const MAX_EXPECTED_TRADES_PER_HOUR = 10;

/**
 * Computes wallet burst behavior feature
 *
 * @param input - Feature computation input
 * @returns Feature result with normalized score (0-1)
 */
export function computeWalletBurst(input: FeatureInput): FeatureResult {
  const { context } = input;

  const rawValue = context.walletTradesLastHour;

  // Normalize: 10+ trades in an hour = score of 1
  const score = Math.min(rawValue / MAX_EXPECTED_TRADES_PER_HOUR, 1);

  return {
    name: "walletBurst",
    score,
    rawValue,
    description: "Rapid trading activity from wallet",
  };
}

/**
 * Weight for this feature in the overall score
 */
export const WALLET_BURST_WEIGHT = 0.15;
