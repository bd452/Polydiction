/**
 * Orderbook Polling Service
 *
 * Fetches and normalizes orderbook data from the Polymarket CLOB API.
 * Used by cron jobs to capture orderbook snapshots for anomaly detection.
 */

import { queries, type NewOrderbookSnapshot } from "@polydiction/db";
import type { CLOBOrderbook, CLOBOrderbookLevel, CLOBBookResponse } from "@polydiction/types";
import { Timestamp } from "firebase-admin/firestore";
import { env } from "../env";

const { batchInsertOrderbookSnapshots, getActiveMarkets, getTokensByMarket } = queries;

// ============================================================================
// Normalized Types
// ============================================================================

export interface NormalizedOrderbookSnapshot {
  marketId: string;
  tokenId: string;
  bestBid: string;
  bestAsk: string;
  bidDepth: string;
  askDepth: string;
  spread: string;
  timestamp: Date;
  raw?: Record<string, unknown>;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Calculates total depth from orderbook levels
 */
function calculateTotalDepth(levels: CLOBOrderbookLevel[]): string {
  if (levels.length === 0) {
    return "0";
  }

  const total = levels.reduce((sum, level) => {
    return sum + parseFloat(level.size);
  }, 0);

  return total.toString();
}

/**
 * Calculates spread between best bid and ask
 */
function calculateSpread(bestBid: string | null, bestAsk: string | null): string {
  if (!bestBid || !bestAsk) {
    return "0";
  }

  const bid = parseFloat(bestBid);
  const ask = parseFloat(bestAsk);

  if (bid <= 0 || ask <= 0) {
    return "0";
  }

  return (ask - bid).toString();
}

// ============================================================================
// Normalization Functions
// ============================================================================

/**
 * Normalizes a CLOB API orderbook to our internal snapshot format
 */
function normalizeOrderbook(
  clob: CLOBOrderbook,
  marketId: string
): NormalizedOrderbookSnapshot {
  // Get best bid (highest bid price)
  const topBid = clob.bids[0];
  const bestBid = topBid ? topBid.price : "0";

  // Get best ask (lowest ask price)
  const topAsk = clob.asks[0];
  const bestAsk = topAsk ? topAsk.price : "0";

  // Calculate total depth at each side
  const bidDepth = calculateTotalDepth(clob.bids);
  const askDepth = calculateTotalDepth(clob.asks);

  // Calculate spread
  const spread = calculateSpread(bestBid, bestAsk);

  // Parse timestamp
  const timestamp = clob.timestamp ? new Date(clob.timestamp) : new Date();

  return {
    marketId,
    tokenId: clob.asset_id,
    bestBid,
    bestAsk,
    bidDepth,
    askDepth,
    spread,
    timestamp,
    raw: {
      hash: clob.hash,
      bidLevels: clob.bids.length,
      askLevels: clob.asks.length,
    },
  };
}

/**
 * Converts a normalized orderbook snapshot to DB format
 */
function toDbSnapshot(normalized: NormalizedOrderbookSnapshot): NewOrderbookSnapshot {
  return {
    marketId: normalized.marketId,
    tokenId: normalized.tokenId,
    bestBid: normalized.bestBid,
    bestAsk: normalized.bestAsk,
    bidDepth: normalized.bidDepth,
    askDepth: normalized.askDepth,
    spread: normalized.spread,
    timestamp: Timestamp.fromDate(normalized.timestamp),
    raw: normalized.raw,
  };
}

// ============================================================================
// API Client
// ============================================================================

/**
 * Fetches orderbook for a token from the Polymarket CLOB API
 *
 * @param tokenId - Token/asset ID
 * @returns Orderbook data or null if not available
 */
export async function fetchOrderbookFromCLOB(tokenId: string): Promise<CLOBOrderbook | null> {
  const url = `${env.POLYMARKET_API_URL}/book?token_id=${encodeURIComponent(tokenId)}`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    // 404 or other errors indicate no orderbook available
    if (response.status === 404) {
      return null;
    }
    const errorText = await response.text().catch(() => "Unknown error");
    throw new Error(`CLOB API error (${String(response.status)}): ${errorText}`);
  }

  const rawData = (await response.json()) as CLOBBookResponse | CLOBOrderbook;

  // Handle both wrapped and unwrapped responses
  if ("data" in rawData && rawData.data) {
    return rawData.data;
  }

  // Direct orderbook response
  if ("bids" in rawData && "asks" in rawData) {
    return rawData;
  }

  return null;
}

/**
 * Fetches orderbook snapshot for a token and normalizes it
 *
 * @param tokenId - Token/asset ID
 * @param marketId - Market condition ID
 * @returns Normalized snapshot or null if not available
 */
export async function fetchOrderbookSnapshot(
  tokenId: string,
  marketId: string
): Promise<NormalizedOrderbookSnapshot | null> {
  const orderbook = await fetchOrderbookFromCLOB(tokenId);

  if (!orderbook) {
    return null;
  }

  return normalizeOrderbook(orderbook, marketId);
}

// ============================================================================
// Sync Functions
// ============================================================================

/**
 * Result of syncing orderbook for a single token
 */
export interface SyncTokenOrderbookResult {
  tokenId: string;
  marketId: string;
  success: boolean;
  snapshotId?: string;
}

/**
 * Result of syncing orderbooks across all markets
 */
export interface SyncAllOrderbooksResult {
  tokens: SyncTokenOrderbookResult[];
  totalTokens: number;
  successCount: number;
  failureCount: number;
  errors: { tokenId: string; error: string }[];
}

/**
 * Fetches orderbook snapshot for a token and syncs to database
 *
 * @param tokenId - Token/asset ID
 * @param marketId - Market condition ID
 * @returns Sync result
 */
export async function syncOrderbookForToken(
  tokenId: string,
  marketId: string
): Promise<SyncTokenOrderbookResult> {
  try {
    const snapshot = await fetchOrderbookSnapshot(tokenId, marketId);

    if (!snapshot) {
      return {
        tokenId,
        marketId,
        success: false,
      };
    }

    const dbSnapshot = toDbSnapshot(snapshot);
    const ids = await batchInsertOrderbookSnapshots([dbSnapshot]);

    return {
      tokenId,
      marketId,
      success: true,
      snapshotId: ids[0],
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error(`Error syncing orderbook for token ${tokenId}:`, errorMessage);

    return {
      tokenId,
      marketId,
      success: false,
    };
  }
}

/**
 * Fetches orderbook snapshots for all tokens in active markets
 *
 * This is the main entry point for the orderbook sync cron job.
 * It iterates through all active markets and their tokens,
 * fetching orderbook snapshots for each.
 *
 * @param options - Sync options
 * @returns Sync result with counts and any errors
 */
export async function syncOrderbooksForAllMarkets(options: {
  /** Maximum number of markets to process (for rate limiting) */
  maxMarkets?: number;
  /** Maximum tokens per market to process */
  maxTokensPerMarket?: number;
} = {}): Promise<SyncAllOrderbooksResult> {
  const { maxMarkets = 50, maxTokensPerMarket = 10 } = options;

  // Get all active markets
  const activeMarkets = await getActiveMarkets();

  // Limit the number of markets processed per run
  const marketsToProcess = activeMarkets.slice(0, maxMarkets);

  const results: SyncTokenOrderbookResult[] = [];
  const errors: { tokenId: string; error: string }[] = [];

  let successCount = 0;
  let failureCount = 0;

  // Process markets sequentially to avoid rate limits
  for (const market of marketsToProcess) {
    try {
      // Get tokens for this market
      const tokens = await getTokensByMarket(market.id);
      const tokensToProcess = tokens.slice(0, maxTokensPerMarket);

      // Fetch orderbooks for each token
      for (const token of tokensToProcess) {
        try {
          const snapshot = await fetchOrderbookSnapshot(token.id, market.id);

          if (snapshot) {
            const dbSnapshot = toDbSnapshot(snapshot);
            const ids = await batchInsertOrderbookSnapshots([dbSnapshot]);

            results.push({
              tokenId: token.id,
              marketId: market.id,
              success: true,
              snapshotId: ids[0],
            });
            successCount++;
          } else {
            results.push({
              tokenId: token.id,
              marketId: market.id,
              success: false,
            });
            failureCount++;
          }
        } catch (tokenError) {
          const errorMessage = tokenError instanceof Error ? tokenError.message : "Unknown error";
          console.error(`Error fetching orderbook for token ${token.id}:`, errorMessage);
          errors.push({
            tokenId: token.id,
            error: errorMessage,
          });
          failureCount++;
        }
      }
    } catch (marketError) {
      const errorMessage = marketError instanceof Error ? marketError.message : "Unknown error";
      console.error(`Error processing market ${market.id}:`, errorMessage);
    }
  }

  return {
    tokens: results,
    totalTokens: results.length,
    successCount,
    failureCount,
    errors,
  };
}

/**
 * Fetches orderbook snapshot for a single token (for on-demand use)
 *
 * @param tokenId - Token/asset ID
 * @param marketId - Market condition ID
 * @returns The snapshot ID if successful, null otherwise
 */
export async function captureOrderbookSnapshot(
  tokenId: string,
  marketId: string
): Promise<string | null> {
  const snapshot = await fetchOrderbookSnapshot(tokenId, marketId);

  if (!snapshot) {
    return null;
  }

  const dbSnapshot = toDbSnapshot(snapshot);
  const ids = await batchInsertOrderbookSnapshots([dbSnapshot]);

  return ids[0] ?? null;
}
