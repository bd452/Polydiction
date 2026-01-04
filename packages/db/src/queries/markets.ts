import { Timestamp } from "firebase-admin/firestore";
import { getMarketsCollection } from "../collections";
import type { Market, NewMarket } from "../schema";
import {
  getDocumentById,
  getDocumentsByIds,
  processBatches,
  countBatchResults,
  extractDocsData,
} from "../utils/firestore";

/**
 * Get a market by ID
 */
export async function getMarket(id: string): Promise<Market | null> {
  return getDocumentById(getMarketsCollection(), id);
}

/**
 * Get multiple markets by IDs
 */
export async function getMarkets(ids: string[]): Promise<Market[]> {
  return getDocumentsByIds(getMarketsCollection(), ids);
}

/**
 * Get all active markets
 */
export async function getActiveMarkets(): Promise<Market[]> {
  const snapshot = await getMarketsCollection()
    .where("active", "==", true)
    .orderBy("updatedAt", "desc")
    .get();

  return extractDocsData(snapshot);
}

/**
 * Get markets by category
 */
export async function getMarketsByCategory(category: string): Promise<Market[]> {
  const snapshot = await getMarketsCollection()
    .where("category", "==", category)
    .where("active", "==", true)
    .get();

  return extractDocsData(snapshot);
}

/**
 * Upsert a market (create or update)
 * Returns true if created, false if updated
 */
export async function upsertMarket(market: NewMarket): Promise<boolean> {
  const collection = getMarketsCollection();
  const docRef = collection.doc(market.id);
  const existingDoc = await docRef.get();

  const now = Timestamp.now();

  if (!existingDoc.exists) {
    // Create new market
    const newMarket: Market = {
      ...market,
      endDate: market.endDate ?? null,
      active: market.active ?? true,
      createdAt: market.createdAt ?? now,
      updatedAt: market.updatedAt ?? now,
    };
    await docRef.set(newMarket);
    return true;
  } else {
    // Update existing market
    await docRef.update({
      slug: market.slug,
      question: market.question,
      description: market.description,
      category: market.category,
      endDate: market.endDate ?? null,
      active: market.active ?? true,
      raw: market.raw,
      updatedAt: now,
    });
    return false;
  }
}

/**
 * Batch upsert markets
 * Returns count of created and updated markets
 */
export async function batchUpsertMarkets(
  markets: NewMarket[]
): Promise<{ created: number; updated: number }> {
  const results = await processBatches(markets, upsertMarket);
  return countBatchResults(results);
}

/**
 * Deactivate a market
 */
export async function deactivateMarket(id: string): Promise<void> {
  await getMarketsCollection().doc(id).update({
    active: false,
    updatedAt: Timestamp.now(),
  });
}

/**
 * Search markets by question (simple prefix search)
 * Note: For full-text search, consider using Algolia or similar
 */
export async function searchMarkets(query: string, limit = 20): Promise<Market[]> {
  const lowerQuery = query.toLowerCase();

  // Firestore doesn't support full-text search natively
  // This fetches active markets and filters client-side
  // For production, consider using a dedicated search service
  const snapshot = await getMarketsCollection()
    .where("active", "==", true)
    .orderBy("updatedAt", "desc")
    .limit(limit * 5) // Fetch more to account for filtering
    .get();

  const markets = extractDocsData(snapshot)
    .filter(
      (m) =>
        m.question.toLowerCase().includes(lowerQuery) ||
        m.description.toLowerCase().includes(lowerQuery)
    )
    .slice(0, limit);

  return markets;
}
