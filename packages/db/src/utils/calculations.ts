/**
 * Pure calculation utilities for query helpers
 * These are extracted for testability without Firestore mocking
 */

/**
 * Calculate median from an array of numbers
 */
export function calculateMedian(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const midIndex = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    const lower = sorted[midIndex - 1];
    const upper = sorted[midIndex];
    return lower !== undefined && upper !== undefined ? (lower + upper) / 2 : null;
  } else {
    return sorted[midIndex] ?? null;
  }
}

/**
 * Calculate ramp speed (rate of change per hour)
 * @param startValue - Initial position value
 * @param endValue - Final position value
 * @param timeDeltaMs - Time difference in milliseconds
 * @returns Ramp speed in units per hour, or null if invalid
 */
export function calculateRampSpeed(
  startValue: number,
  endValue: number,
  timeDeltaMs: number
): number | null {
  if (timeDeltaMs <= 0) {
    return null;
  }

  const positionChange = endValue - startValue;
  // Convert to per-hour rate (3600000 ms = 1 hour)
  return (positionChange / timeDeltaMs) * 3600000;
}

/**
 * Calculate position concentration (fraction of total)
 * @param walletPosition - Wallet's position size
 * @param totalMarketPosition - Total market position size
 * @returns Concentration as a decimal (0-1), or null if invalid
 */
export function calculateConcentration(
  walletPosition: number,
  totalMarketPosition: number
): number | null {
  if (totalMarketPosition <= 0) {
    return null;
  }

  return walletPosition / totalMarketPosition;
}

/**
 * Calculate weighted average for incremental baseline updates
 * @param existingValue - Current baseline value
 * @param existingCount - Number of samples in current baseline
 * @param newValue - New value to incorporate
 * @param newCount - Number of samples in new value
 * @returns Weighted average
 */
export function calculateWeightedAverage(
  existingValue: number,
  existingCount: number,
  newValue: number,
  newCount: number
): number {
  const totalSamples = existingCount + newCount;
  if (totalSamples === 0) {
    return 0;
  }

  return (existingValue * existingCount + newValue * newCount) / totalSamples;
}

/**
 * Calculate average from an array of numbers
 */
export function calculateAverage(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }

  const sum = values.reduce((acc, val) => acc + val, 0);
  return sum / values.length;
}

/**
 * Check if a value is stale based on age
 * @param lastUpdateMs - Timestamp of last update in milliseconds
 * @param currentMs - Current timestamp in milliseconds
 * @param maxAgeMs - Maximum age before considered stale
 */
export function isStale(lastUpdateMs: number, currentMs: number, maxAgeMs: number): boolean {
  return currentMs - lastUpdateMs > maxAgeMs;
}
