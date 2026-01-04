/**
 * Environment variable configuration
 *
 * Uses lazy validation - environment variables are only validated when accessed,
 * not at module load time. This allows Next.js to build without all env vars present.
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
  const nodeEnv = process.env.NODE_ENV as unknown;
  return typeof nodeEnv === "string" ? nodeEnv : "development";
}

/**
 * Environment configuration object with lazy validation.
 *
 * Required environment variables are only validated when accessed,
 * allowing the build to succeed without them present.
 */
export const env = {
  /** Firebase project ID */
  get FIREBASE_PROJECT_ID(): string {
    return getEnvVar("FIREBASE_PROJECT_ID");
  },

  /** Firebase service account client email */
  get FIREBASE_CLIENT_EMAIL(): string {
    return getEnvVar("FIREBASE_CLIENT_EMAIL");
  },

  /** Firebase service account private key */
  get FIREBASE_PRIVATE_KEY(): string {
    return getEnvVar("FIREBASE_PRIVATE_KEY");
  },

  /** Polymarket CLOB API base URL */
  get POLYMARKET_API_URL(): string {
    return getEnvVar("POLYMARKET_API_URL", false) || "https://clob.polymarket.com";
  },

  /** Polymarket Gamma API base URL */
  get GAMMA_API_URL(): string {
    return getEnvVar("GAMMA_API_URL", false) || "https://gamma-api.polymarket.com";
  },

  /** Alert sensitivity (0.0 - 1.0) */
  get ALERT_SENSITIVITY(): number {
    return parseFloat(getEnvVar("ALERT_SENSITIVITY", false) || "0.3");
  },

  /** Node environment */
  get NODE_ENV(): string {
    return getNodeEnv();
  },

  /** Is production environment */
  get isProduction(): boolean {
    return getNodeEnv() === "production";
  },
};
