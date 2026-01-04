/**
 * Environment variable configuration
 * Validates required env vars at runtime
 */

function getEnvVar(name: string, required = true): string {
  const value = process.env[name];
  if (required && !value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value ?? "";
}

function getNodeEnv(): string {
  // Cast to unknown first to satisfy strict linting
  const env = process.env.NODE_ENV as unknown;
  return typeof env === "string" ? env : "development";
}

export const env = {
  /** Database connection string */
  DATABASE_URL: getEnvVar("DATABASE_URL"),

  /** Polymarket CLOB API base URL */
  POLYMARKET_API_URL: getEnvVar("POLYMARKET_API_URL", false) || "https://clob.polymarket.com",

  /** Polymarket Gamma API base URL */
  GAMMA_API_URL: getEnvVar("GAMMA_API_URL", false) || "https://gamma-api.polymarket.com",

  /** Alert sensitivity (0.0 - 1.0) */
  ALERT_SENSITIVITY: parseFloat(getEnvVar("ALERT_SENSITIVITY", false) || "0.3"),

  /** Node environment */
  NODE_ENV: getNodeEnv(),

  /** Is production environment */
  isProduction: getNodeEnv() === "production",
};
