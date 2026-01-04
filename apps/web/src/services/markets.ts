/**
 * Market Discovery Service
 *
 * Fetches and normalizes market data from the Polymarket Gamma API.
 * Used by cron jobs to maintain an up-to-date market universe.
 */

import { queries, type NewMarket, type NewToken } from "@polydiction/db";
import type { GammaMarket, GammaMarketsResponse, GammaToken } from "@polydiction/types";
import { Timestamp } from "firebase-admin/firestore";
import { env } from "../env";

const { batchUpsertMarkets, batchUpsertTokens } = queries;

// ============================================================================
// Normalized Types (matching internal schema)
// ============================================================================

export interface NormalizedMarket {
  id: string;
  slug: string;
  question: string;
  description: string;
  category: string;
  endDate: Date | null;
  active: boolean;
  raw: Record<string, unknown>;
}

export interface NormalizedToken {
  id: string;
  marketId: string;
  outcome: string;
  price: string;
  raw: Record<string, unknown>;
}

export interface MarketWithTokens {
  market: NormalizedMarket;
  tokens: NormalizedToken[];
}

// ============================================================================
// Category Mapping
// ============================================================================

/**
 * Maps Gamma API categories to our internal category enum
 */
function normalizeCategory(category: string | undefined): string {
  if (!category) return "other";

  const lowerCategory = category.toLowerCase();

  // Political categories
  if (
    lowerCategory.includes("politic") ||
    lowerCategory.includes("election") ||
    lowerCategory.includes("congress") ||
    lowerCategory.includes("president")
  ) {
    return "politics";
  }

  // Sports categories
  if (
    lowerCategory.includes("sport") ||
    lowerCategory.includes("nfl") ||
    lowerCategory.includes("nba") ||
    lowerCategory.includes("soccer") ||
    lowerCategory.includes("football") ||
    lowerCategory.includes("baseball") ||
    lowerCategory.includes("hockey") ||
    lowerCategory.includes("tennis") ||
    lowerCategory.includes("mma") ||
    lowerCategory.includes("boxing")
  ) {
    return "sports";
  }

  // Crypto/Finance categories
  if (
    lowerCategory.includes("crypto") ||
    lowerCategory.includes("bitcoin") ||
    lowerCategory.includes("ethereum") ||
    lowerCategory.includes("finance") ||
    lowerCategory.includes("stock") ||
    lowerCategory.includes("economic")
  ) {
    return "crypto";
  }

  // Entertainment categories
  if (
    lowerCategory.includes("entertainment") ||
    lowerCategory.includes("award") ||
    lowerCategory.includes("oscars") ||
    lowerCategory.includes("grammy") ||
    lowerCategory.includes("movie") ||
    lowerCategory.includes("tv")
  ) {
    return "entertainment";
  }

  // Science categories
  if (
    lowerCategory.includes("science") ||
    lowerCategory.includes("weather") ||
    lowerCategory.includes("climate") ||
    lowerCategory.includes("space")
  ) {
    return "science";
  }

  // Current events (catch-all for news-like categories)
  if (
    lowerCategory.includes("news") ||
    lowerCategory.includes("current") ||
    lowerCategory.includes("world")
  ) {
    return "current_events";
  }

  return "other";
}

// ============================================================================
// Normalization Functions
// ============================================================================

/**
 * Normalizes a Gamma API market to our internal format
 */
function normalizeMarket(gamma: GammaMarket): NormalizedMarket {
  // Parse end date from various possible fields
  let endDate: Date | null = null;
  if (gamma.end_date_iso) {
    const parsed = new Date(gamma.end_date_iso);
    if (!isNaN(parsed.getTime())) {
      endDate = parsed;
    }
  } else if (gamma.game_start_time) {
    // Sports markets may use game_start_time
    const parsed = new Date(gamma.game_start_time);
    if (!isNaN(parsed.getTime())) {
      endDate = parsed;
    }
  }

  return {
    id: gamma.condition_id,
    slug: gamma.slug ?? gamma.condition_id,
    question: gamma.question,
    description: gamma.description ?? "",
    category: normalizeCategory(gamma.category),
    endDate,
    active: gamma.active && !gamma.closed && !gamma.archived,
    raw: gamma as Record<string, unknown>,
  };
}

/**
 * Normalizes a Gamma API token to our internal format
 */
function normalizeToken(token: GammaToken, marketId: string): NormalizedToken {
  return {
    id: token.token_id,
    marketId,
    outcome: token.outcome,
    price: token.price ?? "0",
    raw: token as unknown as Record<string, unknown>,
  };
}

/**
 * Normalizes a full market response including tokens
 */
export function normalizeMarketWithTokens(gamma: GammaMarket): MarketWithTokens {
  const market = normalizeMarket(gamma);
  const tokens = gamma.tokens.map((t) => normalizeToken(t, market.id));

  return { market, tokens };
}

// ============================================================================
// API Client
// ============================================================================

/**
 * Options for fetching markets
 */
export interface FetchMarketsOptions {
  /** Only fetch active (not closed/archived) markets */
  activeOnly?: boolean;
  /** Maximum number of markets to fetch per page */
  limit?: number;
  /** Cursor for pagination */
  cursor?: string;
  /** Category filter */
  category?: string;
}

/**
 * Result of fetching markets
 */
export interface FetchMarketsResult {
  markets: MarketWithTokens[];
  nextCursor?: string;
  hasMore: boolean;
}

/**
 * Fetches markets from the Polymarket Gamma API
 *
 * @param options - Fetch options (active filter, pagination, etc.)
 * @returns Normalized markets with tokens
 */
export async function fetchMarketsFromGamma(
  options: FetchMarketsOptions = {}
): Promise<FetchMarketsResult> {
  const { activeOnly = true, limit = 100, cursor, category } = options;

  // Build query parameters
  const params = new URLSearchParams();
  if (activeOnly) {
    params.set("active", "true");
    params.set("closed", "false");
  }
  params.set("limit", String(limit));
  if (cursor) {
    params.set("cursor", cursor);
  }
  if (category) {
    params.set("tag", category);
  }

  const url = `${env.GAMMA_API_URL}/markets?${params.toString()}`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error");
    throw new Error(`Gamma API error (${String(response.status)}): ${errorText}`);
  }

  const rawData = (await response.json()) as GammaMarketsResponse | GammaMarket[];

  // Handle both array and object responses
  let gammaMarkets: GammaMarket[];
  let nextCursor: string | undefined;

  if (Array.isArray(rawData)) {
    gammaMarkets = rawData;
    nextCursor = undefined;
  } else {
    gammaMarkets = rawData.data ?? [];
    nextCursor = rawData.next_cursor;
  }

  // Normalize all markets
  const markets = gammaMarkets.map(normalizeMarketWithTokens);

  return {
    markets,
    nextCursor,
    hasMore: !!nextCursor || gammaMarkets.length >= limit,
  };
}

/**
 * Fetches all active markets, handling pagination automatically
 *
 * @param options - Fetch options
 * @param maxPages - Maximum number of pages to fetch (safety limit)
 * @returns All normalized markets with tokens
 */
export async function fetchAllActiveMarkets(
  options: Omit<FetchMarketsOptions, "cursor"> = {},
  maxPages = 50
): Promise<MarketWithTokens[]> {
  const allMarkets: MarketWithTokens[] = [];
  let cursor: string | undefined;
  let pageCount = 0;

  do {
    const result = await fetchMarketsFromGamma({
      ...options,
      activeOnly: true,
      cursor,
    });

    allMarkets.push(...result.markets);
    cursor = result.nextCursor;
    pageCount++;

    // Safety check to prevent infinite loops
    if (pageCount >= maxPages) {
      console.warn(`Reached max pages (${String(maxPages)}), stopping pagination`);
      break;
    }

    // If no cursor and no more results, stop
    if (!result.hasMore) {
      break;
    }
  } while (cursor);

  return allMarkets;
}

/**
 * Fetches a single market by condition ID
 *
 * @param conditionId - The market's condition ID
 * @returns The normalized market with tokens, or null if not found
 */
export async function fetchMarketById(conditionId: string): Promise<MarketWithTokens | null> {
  const url = `${env.GAMMA_API_URL}/markets/${conditionId}`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error");
    throw new Error(`Gamma API error (${String(response.status)}): ${errorText}`);
  }

  const gamma = (await response.json()) as GammaMarket;
  return normalizeMarketWithTokens(gamma);
}

// ============================================================================
// DB Conversion Functions
// ============================================================================

/**
 * Converts a normalized market to DB format
 */
function toDbMarket(normalized: NormalizedMarket): NewMarket {
  return {
    id: normalized.id,
    slug: normalized.slug,
    question: normalized.question,
    description: normalized.description,
    category: normalized.category,
    endDate: normalized.endDate ? Timestamp.fromDate(normalized.endDate) : null,
    active: normalized.active,
    raw: normalized.raw,
  };
}

/**
 * Converts a normalized token to DB format
 */
function toDbToken(normalized: NormalizedToken): NewToken {
  return {
    id: normalized.id,
    marketId: normalized.marketId,
    outcome: normalized.outcome,
    price: normalized.price,
    raw: normalized.raw,
  };
}

// ============================================================================
// Sync Functions
// ============================================================================

/**
 * Result of syncing markets
 */
export interface SyncMarketsResult {
  markets: { created: number; updated: number };
  tokens: { created: number; updated: number };
  totalFetched: number;
}

/**
 * Fetches all active markets from Gamma API and syncs to database
 *
 * This is the main entry point for the market sync cron job.
 * It fetches all active markets with pagination, normalizes them,
 * and upserts them to Firestore.
 *
 * @returns Sync result with counts of created and updated records
 */
export async function syncMarketsFromGamma(): Promise<SyncMarketsResult> {
  // Fetch all active markets from Gamma API
  const marketsWithTokens = await fetchAllActiveMarkets();

  // Convert to DB format
  const dbMarkets = marketsWithTokens.map((m) => toDbMarket(m.market));
  const dbTokens = marketsWithTokens.flatMap((m) => m.tokens.map(toDbToken));

  // Upsert to database
  const [marketsResult, tokensResult] = await Promise.all([
    batchUpsertMarkets(dbMarkets),
    batchUpsertTokens(dbTokens),
  ]);

  return {
    markets: marketsResult,
    tokens: tokensResult,
    totalFetched: marketsWithTokens.length,
  };
}

/**
 * Fetches a single market from Gamma API and syncs to database
 *
 * @param conditionId - The market's condition ID
 * @returns The synced market with tokens, or null if not found
 */
export async function syncMarketById(conditionId: string): Promise<MarketWithTokens | null> {
  const marketWithTokens = await fetchMarketById(conditionId);

  if (!marketWithTokens) {
    return null;
  }

  // Convert to DB format and upsert
  const dbMarket = toDbMarket(marketWithTokens.market);
  const dbTokens = marketWithTokens.tokens.map(toDbToken);

  await Promise.all([batchUpsertMarkets([dbMarket]), batchUpsertTokens(dbTokens)]);

  return marketWithTokens;
}
