import { Timestamp } from "firebase-admin/firestore";
import { getTradesCollection } from "../collections";
import type { Trade, NewTrade } from "../schema";
import { calculateMedian } from "../utils/calculations";
import {
  getDocumentById,
  processBatches,
  extractDocsData,
  getFirstDocOrNull,
} from "../utils/firestore";

/**
 * Get a trade by ID
 */
export async function getTrade(id: string): Promise<Trade | null> {
  return getDocumentById(getTradesCollection(), id);
}

/**
 * Get trades by market ID, ordered by timestamp descending
 */
export async function getTradesByMarket(
  marketId: string,
  options: { limit?: number; afterTimestamp?: Timestamp } = {}
): Promise<Trade[]> {
  const { limit = 100, afterTimestamp } = options;

  let query = getTradesCollection().where("marketId", "==", marketId).orderBy("timestamp", "desc");

  if (afterTimestamp) {
    query = query.where("timestamp", "<", afterTimestamp);
  }

  const snapshot = await query.limit(limit).get();
  return extractDocsData(snapshot);
}

/**
 * Get trades by token ID, ordered by timestamp descending
 */
export async function getTradesByToken(
  tokenId: string,
  options: { limit?: number } = {}
): Promise<Trade[]> {
  const { limit = 100 } = options;

  const snapshot = await getTradesCollection()
    .where("tokenId", "==", tokenId)
    .orderBy("timestamp", "desc")
    .limit(limit)
    .get();

  return extractDocsData(snapshot);
}

/**
 * Get trades by wallet (maker or taker)
 * Note: This requires two separate queries due to Firestore limitations
 */
export async function getTradesByWallet(
  wallet: string,
  options: { limit?: number } = {}
): Promise<Trade[]> {
  const { limit = 100 } = options;

  // Query for trades where wallet is maker
  const makerSnapshot = await getTradesCollection()
    .where("maker", "==", wallet)
    .orderBy("timestamp", "desc")
    .limit(limit)
    .get();

  // Query for trades where wallet is taker
  const takerSnapshot = await getTradesCollection()
    .where("taker", "==", wallet)
    .orderBy("timestamp", "desc")
    .limit(limit)
    .get();

  // Merge and deduplicate
  const tradesMap = new Map<string, Trade>();

  makerSnapshot.docs.forEach((doc) => {
    const trade = doc.data();
    tradesMap.set(trade.id, trade);
  });

  takerSnapshot.docs.forEach((doc) => {
    const trade = doc.data();
    tradesMap.set(trade.id, trade);
  });

  // Sort by timestamp descending and limit
  return Array.from(tradesMap.values())
    .sort((a, b) => b.timestamp.toMillis() - a.timestamp.toMillis())
    .slice(0, limit);
}

/**
 * Get recent trades for a market within a time window
 */
export async function getRecentTrades(marketId: string, windowMs: number): Promise<Trade[]> {
  const cutoff = Timestamp.fromMillis(Date.now() - windowMs);

  const snapshot = await getTradesCollection()
    .where("marketId", "==", marketId)
    .where("timestamp", ">=", cutoff)
    .orderBy("timestamp", "desc")
    .get();

  return extractDocsData(snapshot);
}

/**
 * Insert a trade with deduplication
 * Returns true if inserted, false if already exists
 */
export async function insertTrade(trade: NewTrade): Promise<boolean> {
  const collection = getTradesCollection();
  const docRef = collection.doc(trade.id);
  const existingDoc = await docRef.get();

  if (existingDoc.exists) {
    // Trade already exists, skip
    return false;
  }

  const newTrade: Trade = {
    ...trade,
    createdAt: trade.createdAt ?? Timestamp.now(),
  };

  await docRef.set(newTrade);
  return true;
}

/**
 * Batch insert trades with deduplication
 * Returns count of inserted trades (skips duplicates)
 */
export async function batchInsertTrades(trades: NewTrade[]): Promise<number> {
  // Use smaller batch size for trades to avoid memory issues
  const results = await processBatches(trades, insertTrade, 100);
  return results.filter((r) => r).length;
}

/**
 * Get latest trade timestamp for a market
 * Useful for polling only new trades
 */
export async function getLatestTradeTimestamp(marketId: string): Promise<Timestamp | null> {
  const snapshot = await getTradesCollection()
    .where("marketId", "==", marketId)
    .orderBy("timestamp", "desc")
    .limit(1)
    .get();

  const trade = getFirstDocOrNull(snapshot);
  return trade?.timestamp ?? null;
}

/**
 * Calculate median trade size for a market
 * Used for feature computation
 */
export async function getMedianTradeSize(
  marketId: string,
  windowMs: number
): Promise<string | null> {
  const trades = await getRecentTrades(marketId, windowMs);

  if (trades.length === 0) {
    return null;
  }

  const sizes = trades.map((t) => parseFloat(t.size));
  const median = calculateMedian(sizes);

  return median !== null ? median.toString() : null;
}
