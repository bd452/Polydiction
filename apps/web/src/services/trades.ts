/**
 * Trade Polling Service
 *
 * Fetches and normalizes trade data from the Polymarket CLOB API.
 * Used by cron jobs to ingest trades for anomaly detection.
 */

import { queries, type NewTrade } from "@polydiction/db";
import type { CLOBTrade, CLOBTradesResponse, FetchTradesOptions } from "@polydiction/types";
import { Timestamp } from "firebase-admin/firestore";
import { env } from "../env";

const { batchInsertTrades, getLatestTradeTimestamp, getActiveMarkets } = queries;

// ============================================================================
// Normalized Types (matching internal schema)
// ============================================================================

export interface NormalizedTrade {
  id: string;
  marketId: string;
  tokenId: string;
  maker: string;
  taker: string;
  side: "BUY" | "SELL";
  size: string;
  price: string;
  timestamp: Date;
  raw: Record<string, unknown>;
}

// ============================================================================
// Normalization Functions
// ============================================================================

/**
 * Normalizes a CLOB API trade to our internal format
 */
function normalizeTrade(clob: CLOBTrade): NormalizedTrade {
  // Parse timestamp from match_time
  const timestamp = new Date(clob.match_time);

  // Normalize side to uppercase
  const side = clob.side.toUpperCase() as "BUY" | "SELL";

  return {
    id: clob.id,
    marketId: clob.market,
    tokenId: clob.asset_id,
    maker: clob.maker_address,
    taker: clob.owner,
    side,
    size: clob.size,
    price: clob.price,
    timestamp,
    raw: clob as unknown as Record<string, unknown>,
  };
}

/**
 * Converts a normalized trade to DB format
 */
function toDbTrade(normalized: NormalizedTrade): NewTrade {
  return {
    id: normalized.id,
    marketId: normalized.marketId,
    tokenId: normalized.tokenId,
    maker: normalized.maker,
    taker: normalized.taker,
    side: normalized.side,
    size: normalized.size,
    price: normalized.price,
    timestamp: Timestamp.fromDate(normalized.timestamp),
    raw: normalized.raw,
  };
}

// ============================================================================
// API Client
// ============================================================================

/**
 * Result of fetching trades
 */
export interface FetchTradesResult {
  trades: NormalizedTrade[];
  nextCursor?: string;
  hasMore: boolean;
}

/**
 * Fetches trades from the Polymarket CLOB API
 *
 * @param options - Fetch options (market filter, pagination, etc.)
 * @returns Normalized trades
 */
export async function fetchTradesFromCLOB(
  options: FetchTradesOptions = {}
): Promise<FetchTradesResult> {
  const { marketId, assetId, maker, cursor, limit = 100, after, before } = options;

  // Build query parameters
  const params = new URLSearchParams();

  if (marketId) {
    params.set("market", marketId);
  }
  if (assetId) {
    params.set("asset_id", assetId);
  }
  if (maker) {
    params.set("maker_address", maker);
  }
  if (cursor) {
    params.set("next_cursor", cursor);
  }
  params.set("limit", String(Math.min(limit, 500))); // Max 500 per CLOB API

  if (after) {
    params.set("after", after);
  }
  if (before) {
    params.set("before", before);
  }

  const url = `${env.POLYMARKET_API_URL}/trades?${params.toString()}`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error");
    throw new Error(`CLOB API error (${String(response.status)}): ${errorText}`);
  }

  const rawData = (await response.json()) as CLOBTradesResponse | CLOBTrade[];

  // Handle both array and object responses
  let clobTrades: CLOBTrade[];
  let nextCursor: string | undefined;

  if (Array.isArray(rawData)) {
    clobTrades = rawData;
    nextCursor = undefined;
  } else {
    clobTrades = rawData.data ?? [];
    nextCursor = rawData.next_cursor;
  }

  // Normalize all trades
  const trades = clobTrades.map(normalizeTrade);

  return {
    trades,
    nextCursor,
    hasMore: !!nextCursor || clobTrades.length >= limit,
  };
}

/**
 * Fetches all trades for a market since the last known trade
 *
 * @param marketId - Market condition ID
 * @param maxPages - Maximum number of pages to fetch (safety limit)
 * @returns All new trades
 */
export async function fetchNewTradesForMarket(
  marketId: string,
  maxPages = 10
): Promise<NormalizedTrade[]> {
  // Get the latest trade timestamp for this market
  const latestTimestamp = await getLatestTradeTimestamp(marketId);

  // Format as ISO string for the after parameter (add 1ms to avoid duplicates)
  const afterTimestamp = latestTimestamp
    ? new Date(latestTimestamp.toMillis() + 1).toISOString()
    : undefined;

  const allTrades: NormalizedTrade[] = [];
  let cursor: string | undefined;
  let pageCount = 0;

  do {
    const result = await fetchTradesFromCLOB({
      marketId,
      cursor,
      after: afterTimestamp,
      limit: 500, // Max per page for efficiency
    });

    allTrades.push(...result.trades);
    cursor = result.nextCursor;
    pageCount++;

    // Safety check to prevent infinite loops
    if (pageCount >= maxPages) {
      console.warn(
        `Market ${marketId}: Reached max pages (${String(maxPages)}), stopping pagination`
      );
      break;
    }

    // If no cursor and no more results, stop
    if (!result.hasMore) {
      break;
    }
  } while (cursor);

  return allTrades;
}

// ============================================================================
// Sync Functions
// ============================================================================

/**
 * Result of syncing trades for a single market
 */
export interface SyncMarketTradesResult {
  marketId: string;
  fetched: number;
  inserted: number;
}

/**
 * Result of syncing trades across all markets
 */
export interface SyncAllTradesResult {
  markets: SyncMarketTradesResult[];
  totalFetched: number;
  totalInserted: number;
  totalMarkets: number;
  errors: { marketId: string; error: string }[];
}

/**
 * Fetches new trades for a market and syncs to database
 *
 * @param marketId - Market condition ID
 * @returns Sync result with counts
 */
export async function syncTradesForMarket(marketId: string): Promise<SyncMarketTradesResult> {
  // Fetch new trades since last known trade
  const trades = await fetchNewTradesForMarket(marketId);

  if (trades.length === 0) {
    return {
      marketId,
      fetched: 0,
      inserted: 0,
    };
  }

  // Convert to DB format
  const dbTrades = trades.map(toDbTrade);

  // Insert with deduplication
  const insertedCount = await batchInsertTrades(dbTrades);

  return {
    marketId,
    fetched: trades.length,
    inserted: insertedCount,
  };
}

/**
 * Fetches new trades for all active markets and syncs to database
 *
 * This is the main entry point for the trade sync cron job.
 * It iterates through all active markets and fetches new trades
 * for each one.
 *
 * @param options - Sync options
 * @returns Sync result with counts and any errors
 */
export async function syncTradesForAllMarkets(options: {
  /** Maximum number of markets to process (for rate limiting) */
  maxMarkets?: number;
  /** Maximum pages per market */
  maxPagesPerMarket?: number;
} = {}): Promise<SyncAllTradesResult> {
  const { maxMarkets = 100, maxPagesPerMarket = 10 } = options;

  // Get all active markets
  const activeMarkets = await getActiveMarkets();

  // Limit the number of markets processed per run
  const marketsToProcess = activeMarkets.slice(0, maxMarkets);

  const results: SyncMarketTradesResult[] = [];
  const errors: { marketId: string; error: string }[] = [];

  let totalFetched = 0;
  let totalInserted = 0;

  // Process markets sequentially to avoid rate limits
  for (const market of marketsToProcess) {
    try {
      // Fetch and sync trades for this market
      const trades = await fetchNewTradesForMarket(market.id, maxPagesPerMarket);

      if (trades.length > 0) {
        const dbTrades = trades.map(toDbTrade);
        const insertedCount = await batchInsertTrades(dbTrades);

        results.push({
          marketId: market.id,
          fetched: trades.length,
          inserted: insertedCount,
        });

        totalFetched += trades.length;
        totalInserted += insertedCount;
      } else {
        results.push({
          marketId: market.id,
          fetched: 0,
          inserted: 0,
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error(`Error syncing trades for market ${market.id}:`, errorMessage);
      errors.push({
        marketId: market.id,
        error: errorMessage,
      });
    }
  }

  return {
    markets: results,
    totalFetched,
    totalInserted,
    totalMarkets: marketsToProcess.length,
    errors,
  };
}

/**
 * Fetches trades for a specific wallet across all markets
 *
 * @param wallet - Wallet address
 * @param options - Fetch options
 * @returns Normalized trades
 */
export async function fetchTradesForWallet(
  wallet: string,
  options: { limit?: number; maxPages?: number } = {}
): Promise<NormalizedTrade[]> {
  const { limit = 500, maxPages = 5 } = options;

  const allTrades: NormalizedTrade[] = [];
  let cursor: string | undefined;
  let pageCount = 0;

  do {
    const result = await fetchTradesFromCLOB({
      maker: wallet,
      cursor,
      limit: Math.min(limit, 500),
    });

    allTrades.push(...result.trades);
    cursor = result.nextCursor;
    pageCount++;

    // Check if we've fetched enough
    if (allTrades.length >= limit) {
      break;
    }

    // Safety check
    if (pageCount >= maxPages) {
      break;
    }

    if (!result.hasMore) {
      break;
    }
  } while (cursor);

  return allTrades.slice(0, limit);
}
