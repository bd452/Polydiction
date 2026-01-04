/**
 * Rate Limit Handling
 *
 * Provides rate limiting utilities for external API calls.
 * Helps prevent hitting API rate limits during polling.
 */

/**
 * Rate limiter configuration
 */
export interface RateLimiterConfig {
  /** Maximum requests per window */
  maxRequests: number;
  /** Window size in milliseconds */
  windowMs: number;
}

/**
 * Simple in-memory rate limiter
 * Note: This is per-instance only. For distributed rate limiting,
 * use Redis or similar.
 */
export class RateLimiter {
  private requests: number[] = [];
  private readonly config: RateLimiterConfig;

  constructor(config: RateLimiterConfig) {
    this.config = config;
  }

  /**
   * Check if a request can be made
   */
  canMakeRequest(): boolean {
    this.pruneOldRequests();
    return this.requests.length < this.config.maxRequests;
  }

  /**
   * Record a request
   */
  recordRequest(): void {
    this.requests.push(Date.now());
  }

  /**
   * Get time until next request is allowed (in ms)
   * Returns 0 if a request can be made now
   */
  getTimeUntilNextRequest(): number {
    this.pruneOldRequests();

    if (this.requests.length < this.config.maxRequests) {
      return 0;
    }

    const oldestRequest = this.requests[0];
    if (oldestRequest === undefined) {
      return 0;
    }

    const timeToWait = oldestRequest + this.config.windowMs - Date.now();
    return Math.max(0, timeToWait);
  }

  /**
   * Wait until a request can be made
   */
  async waitForAvailability(): Promise<void> {
    const waitTime = this.getTimeUntilNextRequest();
    if (waitTime > 0) {
      await sleep(waitTime);
    }
  }

  /**
   * Remove requests outside the current window
   */
  private pruneOldRequests(): void {
    const cutoff = Date.now() - this.config.windowMs;
    this.requests = this.requests.filter((time) => time > cutoff);
  }
}

/**
 * Sleep for a specified duration
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Default rate limiter for Polymarket CLOB API
 * 100 requests per minute
 */
export const clobRateLimiter = new RateLimiter({
  maxRequests: 100,
  windowMs: 60 * 1000, // 1 minute
});

/**
 * Default rate limiter for Polymarket Gamma API
 * 60 requests per minute
 */
export const gammaRateLimiter = new RateLimiter({
  maxRequests: 60,
  windowMs: 60 * 1000, // 1 minute
});

/**
 * Execute a function with rate limiting
 *
 * @param fn - Function to execute
 * @param limiter - Rate limiter to use
 * @returns Result of the function
 */
export async function withRateLimit<T>(fn: () => Promise<T>, limiter: RateLimiter): Promise<T> {
  await limiter.waitForAvailability();
  limiter.recordRequest();
  return fn();
}
