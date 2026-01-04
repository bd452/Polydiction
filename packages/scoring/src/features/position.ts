/**
 * Position Features
 *
 * Measures position-related signals:
 * - Position Concentration: How large is the wallet's position relative to market?
 * - Ramp Speed: How quickly is the wallet building a position?
 */

import type { FeatureInput, FeatureResult } from "./types";

/**
 * Normalize a value using sigmoid-like scaling
 */
function normalize(value: number, median: number): number {
  if (median <= 0) return 0;
  const ratio = value / median;
  return 1 - 1 / (1 + ratio);
}

/**
 * Computes position concentration feature
 *
 * @param input - Feature computation input
 * @returns Feature result with normalized score (0-1)
 */
export function computePositionConcentration(input: FeatureInput): FeatureResult {
  const { context } = input;

  // Calculate what percentage of total market liquidity this wallet holds
  const rawValue =
    context.totalLiquidity > 0 ? context.walletPosition / context.totalLiquidity : 0;

  // Score is capped at 1
  const score = Math.min(rawValue, 1);

  return {
    name: "positionConcentration",
    score,
    rawValue,
    description: "High position concentration",
  };
}

/**
 * Computes position ramp speed feature
 *
 * Measures how quickly the wallet is building/reducing a position
 * over the last hour.
 *
 * @param input - Feature computation input
 * @returns Feature result with normalized score (0-1)
 */
export function computeRampSpeed(input: FeatureInput): FeatureResult {
  const { context } = input;

  // Calculate absolute position change in the last hour
  const positionDelta = Math.abs(context.walletPosition - context.walletPositionHourAgo);

  // Normalize relative to 5x median trade size
  // A position change of 5x median in an hour is considered significant
  const benchmark = context.medianTradeSize * 5;
  const rawValue = benchmark > 0 ? positionDelta / benchmark : positionDelta > 0 ? 1 : 0;
  const score = normalize(positionDelta, benchmark);

  return {
    name: "rampSpeed",
    score,
    rawValue,
    description: "Fast position accumulation",
  };
}

/**
 * Weight for position concentration in the overall score
 */
export const POSITION_CONCENTRATION_WEIGHT = 0.1;

/**
 * Weight for ramp speed in the overall score
 */
export const RAMP_SPEED_WEIGHT = 0.1;
