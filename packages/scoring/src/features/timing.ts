/**
 * Timing Features
 *
 * Measures timing-related signals:
 * - Timing vs Market End: Trades close to resolution may be more informative
 * - Wallet Freshness: New or recently active wallets are more suspicious
 */

import type { FeatureInput, FeatureResult } from "./types";

/**
 * Time windows for timing feature (in milliseconds)
 */
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Computes timing vs market end feature
 *
 * Trades made close to market resolution may indicate
 * the trader has information about the outcome.
 *
 * @param input - Feature computation input
 * @returns Feature result with normalized score (0-1)
 */
export function computeTimingVsMarketEnd(input: FeatureInput): FeatureResult {
  const { trade, market } = input;

  // If no end date, can't compute timing
  if (!market.endDate) {
    return {
      name: "timingVsMarketEnd",
      score: 0,
      rawValue: -1,
      description: "Trade close to market resolution",
    };
  }

  const timeToEnd = market.endDate.getTime() - trade.timestamp.getTime();

  // If already past end date, this is suspicious
  if (timeToEnd <= 0) {
    return {
      name: "timingVsMarketEnd",
      score: 1,
      rawValue: 0,
      description: "Trade after market end date",
    };
  }

  // Calculate score based on proximity to end
  let score = 0;
  const daysToEnd = timeToEnd / ONE_DAY_MS;

  if (daysToEnd < 1) {
    // Less than 1 day to end - very suspicious
    score = 0.9 + 0.1 * (1 - daysToEnd);
  } else if (daysToEnd < 7) {
    // 1-7 days - moderately suspicious
    score = 0.5 + 0.4 * (1 - daysToEnd / 7);
  } else if (daysToEnd < 30) {
    // 7-30 days - slightly elevated
    score = 0.2 + 0.3 * (1 - daysToEnd / 30);
  } else {
    // More than 30 days - low suspicion
    score = 0.1 * (1 - Math.min(daysToEnd / 90, 1));
  }

  return {
    name: "timingVsMarketEnd",
    score: Math.min(score, 1),
    rawValue: daysToEnd,
    description: "Trade close to market resolution",
  };
}

/**
 * Computes wallet freshness feature
 *
 * New or recently active wallets making large trades are more suspicious.
 *
 * @param input - Feature computation input
 * @returns Feature result with normalized score (0-1)
 */
export function computeWalletFreshness(input: FeatureInput): FeatureResult {
  const { context } = input;

  // If wallet age is unknown, return neutral score
  if (context.walletAgeDays === null) {
    return {
      name: "walletFreshness",
      score: 0.5, // Neutral - assume moderate suspicion
      rawValue: -1,
      description: "Wallet age unknown",
    };
  }

  const ageDays = context.walletAgeDays;
  let score = 0;

  if (ageDays < 1) {
    // Brand new wallet - very suspicious
    score = 1;
  } else if (ageDays < 7) {
    // Less than a week - highly suspicious
    score = 0.8;
  } else if (ageDays < 30) {
    // Less than a month - moderately suspicious
    score = 0.4;
  } else if (ageDays < 90) {
    // 1-3 months - slightly suspicious
    score = 0.2;
  } else {
    // Older wallet - low suspicion
    score = 0.1;
  }

  return {
    name: "walletFreshness",
    score,
    rawValue: ageDays,
    description: "New or recently active wallet",
  };
}

/**
 * Computes dollar value feature
 *
 * Large absolute trade values are notable regardless of relative metrics.
 *
 * @param input - Feature computation input
 * @returns Feature result with normalized score (0-1)
 */
export function computeDollarValue(input: FeatureInput): FeatureResult {
  const { context } = input;

  const usdValue = context.tradeUsdValue;

  // Normalize: $5000 = 0.5, $25000 = 0.83, $50000 = 0.91
  const score = usdValue > 0 ? 1 - 1 / (1 + usdValue / 5000) : 0;

  return {
    name: "dollarValue",
    score,
    rawValue: usdValue,
    description: "Large absolute trade value",
  };
}

/**
 * Weight for wallet freshness in the overall score
 */
export const WALLET_FRESHNESS_WEIGHT = 0.1;

/**
 * Weight for dollar value in the overall score
 */
export const DOLLAR_VALUE_WEIGHT = 0.05;
