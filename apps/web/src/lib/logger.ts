/**
 * Basic Logging and Metrics
 *
 * Provides structured logging for cron jobs and services.
 * In production, these logs are captured by Vercel's log system.
 */

/**
 * Log levels
 */
export type LogLevel = "debug" | "info" | "warn" | "error";

/**
 * Log entry structure
 */
export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: string;
  data?: Record<string, unknown>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

/**
 * Logger configuration
 */
export interface LoggerConfig {
  /** Context name (e.g., "cron/trades") */
  context: string;
  /** Minimum log level to output */
  minLevel: LogLevel;
}

/**
 * Log level priority (higher = more severe)
 */
const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

/**
 * Create a structured log entry
 */
function createLogEntry(
  level: LogLevel,
  message: string,
  context?: string,
  data?: Record<string, unknown>,
  error?: Error
): LogEntry {
  const entry: LogEntry = {
    level,
    message,
    timestamp: new Date().toISOString(),
  };

  if (context) {
    entry.context = context;
  }

  if (data) {
    entry.data = data;
  }

  if (error) {
    entry.error = {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  return entry;
}

/**
 * Format log entry for console output
 */
function formatLogEntry(entry: LogEntry): string {
  const prefix = entry.context ? `[${entry.context}]` : "";
  const level = entry.level.toUpperCase().padEnd(5);

  let output = `${entry.timestamp} ${level} ${prefix} ${entry.message}`;

  if (entry.data) {
    output += ` ${JSON.stringify(entry.data)}`;
  }

  if (entry.error) {
    output += `\n  Error: ${entry.error.name}: ${entry.error.message}`;
    if (entry.error.stack) {
      output += `\n  Stack: ${entry.error.stack.split("\n").slice(1, 4).join("\n  ")}`;
    }
  }

  return output;
}

/**
 * Output log entry to console
 */
function outputLog(entry: LogEntry): void {
  const formatted = formatLogEntry(entry);

  switch (entry.level) {
    case "debug":
      console.debug(formatted);
      break;
    case "info":
      console.info(formatted);
      break;
    case "warn":
      console.warn(formatted);
      break;
    case "error":
      console.error(formatted);
      break;
  }
}

/**
 * Logger class for structured logging
 */
export class Logger {
  private readonly config: LoggerConfig;

  constructor(config: LoggerConfig) {
    this.config = config;
  }

  /**
   * Check if a log level should be output
   */
  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[this.config.minLevel];
  }

  /**
   * Log a message
   */
  private log(
    level: LogLevel,
    message: string,
    data?: Record<string, unknown>,
    error?: Error
  ): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const entry = createLogEntry(level, message, this.config.context, data, error);
    outputLog(entry);
  }

  /**
   * Log debug message
   */
  debug(message: string, data?: Record<string, unknown>): void {
    this.log("debug", message, data);
  }

  /**
   * Log info message
   */
  info(message: string, data?: Record<string, unknown>): void {
    this.log("info", message, data);
  }

  /**
   * Log warning message
   */
  warn(message: string, data?: Record<string, unknown>): void {
    this.log("warn", message, data);
  }

  /**
   * Log error message
   */
  error(message: string, error?: Error, data?: Record<string, unknown>): void {
    this.log("error", message, data, error);
  }

  /**
   * Create a child logger with additional context
   */
  child(subContext: string): Logger {
    return new Logger({
      ...this.config,
      context: `${this.config.context}/${subContext}`,
    });
  }
}

/**
 * Create a logger for a specific context
 */
export function createLogger(context: string, minLevel: LogLevel = "info"): Logger {
  return new Logger({ context, minLevel });
}

/**
 * Pre-configured loggers for common contexts
 */
export const loggers = {
  cron: {
    markets: createLogger("cron/markets"),
    trades: createLogger("cron/trades"),
    orderbook: createLogger("cron/orderbook"),
    positions: createLogger("cron/positions"),
  },
  service: {
    markets: createLogger("service/markets"),
    trades: createLogger("service/trades"),
    orderbook: createLogger("service/orderbook"),
    positions: createLogger("service/positions"),
  },
  scoring: createLogger("scoring"),
};

/**
 * Simple metrics tracking
 */
export interface MetricCounter {
  name: string;
  value: number;
  labels?: Record<string, string>;
}

/**
 * In-memory metrics store
 * Note: For production, consider using a proper metrics service
 */
const metricsStore = new Map<string, MetricCounter>();

/**
 * Increment a counter metric
 */
export function incrementCounter(
  name: string,
  value = 1,
  labels?: Record<string, string>
): void {
  const key = labels ? `${name}:${JSON.stringify(labels)}` : name;

  const existing = metricsStore.get(key);
  if (existing) {
    existing.value += value;
  } else {
    metricsStore.set(key, { name, value, labels });
  }
}

/**
 * Get current value of a counter
 */
export function getCounter(name: string, labels?: Record<string, string>): number {
  const key = labels ? `${name}:${JSON.stringify(labels)}` : name;
  return metricsStore.get(key)?.value ?? 0;
}

/**
 * Get all metrics
 */
export function getAllMetrics(): MetricCounter[] {
  return Array.from(metricsStore.values());
}

/**
 * Reset all metrics (useful for testing)
 */
export function resetMetrics(): void {
  metricsStore.clear();
}

/**
 * Log and track a cron job execution
 */
export async function trackCronExecution<T>(
  name: string,
  fn: () => Promise<T>
): Promise<{ result: T; durationMs: number }> {
  const logger = createLogger(`cron/${name}`);
  const startTime = Date.now();

  logger.info("Starting cron job");
  incrementCounter("cron_executions", 1, { job: name });

  try {
    const result = await fn();
    const durationMs = Date.now() - startTime;

    logger.info("Cron job completed", { durationMs });
    incrementCounter("cron_successes", 1, { job: name });

    return { result, durationMs };
  } catch (error) {
    const durationMs = Date.now() - startTime;
    const err = error instanceof Error ? error : new Error(String(error));

    logger.error("Cron job failed", err, { durationMs });
    incrementCounter("cron_failures", 1, { job: name });

    throw error;
  }
}
