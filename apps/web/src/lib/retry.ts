/**
 * Retry / Backoff Logic
 *
 * Provides retry utilities with exponential backoff for handling
 * transient failures in external API calls.
 */

import { sleep } from "./rate-limit";

/**
 * Retry configuration
 */
export interface RetryConfig {
  /** Maximum number of retry attempts */
  maxRetries: number;
  /** Initial delay in milliseconds */
  initialDelayMs: number;
  /** Maximum delay in milliseconds */
  maxDelayMs: number;
  /** Backoff multiplier (e.g., 2 for exponential) */
  backoffMultiplier: number;
  /** Jitter factor (0-1) to randomize delays */
  jitterFactor: number;
  /** HTTP status codes that should trigger a retry */
  retryableStatusCodes: number[];
}

/**
 * Default retry configuration
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
  jitterFactor: 0.1,
  retryableStatusCodes: [408, 429, 500, 502, 503, 504],
};

/**
 * Error class for retryable errors
 */
export class RetryableError extends Error {
  readonly statusCode?: number;
  readonly isRetryable: boolean = true;

  constructor(message: string, statusCode?: number) {
    super(message);
    this.name = "RetryableError";
    this.statusCode = statusCode;
  }
}

/**
 * Calculate delay for a retry attempt with exponential backoff and jitter
 */
export function calculateDelay(attempt: number, config: RetryConfig): number {
  // Exponential backoff
  const exponentialDelay = config.initialDelayMs * Math.pow(config.backoffMultiplier, attempt);

  // Cap at max delay
  const cappedDelay = Math.min(exponentialDelay, config.maxDelayMs);

  // Add jitter
  const jitter = cappedDelay * config.jitterFactor * (Math.random() * 2 - 1);

  return Math.max(0, cappedDelay + jitter);
}

/**
 * Check if an error should be retried
 */
export function shouldRetry(error: unknown, config: RetryConfig): boolean {
  if (error instanceof RetryableError) {
    return true;
  }

  if (error instanceof Error) {
    // Network errors
    if (error.message.includes("ECONNRESET") || error.message.includes("ETIMEDOUT")) {
      return true;
    }

    // Check for status code in error message
    for (const code of config.retryableStatusCodes) {
      if (error.message.includes(String(code))) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Result of a retry operation
 */
export interface RetryResult<T> {
  success: boolean;
  result?: T;
  error?: Error;
  attempts: number;
  totalDelayMs: number;
}

/**
 * Execute a function with retry logic
 *
 * @param fn - Function to execute
 * @param config - Retry configuration (optional, uses defaults)
 * @returns Result with success status and retry info
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<RetryResult<T>> {
  const fullConfig = { ...DEFAULT_RETRY_CONFIG, ...config };

  let lastError: Error | undefined;
  let totalDelayMs = 0;

  for (let attempt = 0; attempt <= fullConfig.maxRetries; attempt++) {
    try {
      const result = await fn();
      return {
        success: true,
        result,
        attempts: attempt + 1,
        totalDelayMs,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Check if we should retry
      if (attempt < fullConfig.maxRetries && shouldRetry(error, fullConfig)) {
        const delay = calculateDelay(attempt, fullConfig);
        totalDelayMs += delay;
        await sleep(delay);
      } else {
        // No more retries or error is not retryable
        break;
      }
    }
  }

  return {
    success: false,
    error: lastError,
    attempts: fullConfig.maxRetries + 1,
    totalDelayMs,
  };
}

/**
 * Execute a function with retry, throwing on final failure
 *
 * @param fn - Function to execute
 * @param config - Retry configuration (optional)
 * @returns Result of the function
 * @throws Last error if all retries fail
 */
export async function withRetryThrow<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<T> {
  const result = await withRetry(fn, config);

  if (!result.success) {
    throw result.error ?? new Error("Retry failed with unknown error");
  }

  return result.result as T;
}

/**
 * Wrap a fetch call with automatic retry for rate limits (429)
 */
export async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  retryConfig: Partial<RetryConfig> = {}
): Promise<Response> {
  return withRetryThrow(async () => {
    const response = await fetch(url, options);

    // Throw retryable error for certain status codes
    if (response.status === 429) {
      throw new RetryableError(`Rate limited: ${String(response.status)}`, response.status);
    }

    if (response.status >= 500) {
      throw new RetryableError(`Server error: ${String(response.status)}`, response.status);
    }

    return response;
  }, retryConfig);
}
