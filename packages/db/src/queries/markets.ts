import { Timestamp } from "firebase-admin/firestore";
import { getMarketsCollection } from "../collections";
import type { Market, NewMarket } from "../schema";

/**
 * Get a market by ID
 */
export async function getMarket(id: string): Promise<Market | null> {
  const doc = await getMarketsCollection().doc(id).get();
  const data = doc.data();
  if (!doc.exists || !data) {
    return null;
  }
  return data;
}

/**
 * Get multiple markets by IDs
 */
export async function getMarkets(ids: string[]): Promise<Market[]> {
  if (ids.length === 0) {
    return [];
  }

  const collection = getMarketsCollection();
  const docs = await Promise.all(ids.map((id) => collection.doc(id).get()));

  return docs
    .filter((doc) => doc.exists)
    .map((doc) => doc.data())
    .filter((data): data is Market => data !== undefined);
}

/**
 * Get all active markets
 */
export async function getActiveMarkets(): Promise<Market[]> {
  const snapshot = await getMarketsCollection()
    .where("active", "==", true)
    .orderBy("updatedAt", "desc")
    .get();

  return snapshot.docs.map((doc) => doc.data());
}

/**
 * Get markets by category
 */
export async function getMarketsByCategory(category: string): Promise<Market[]> {
  const snapshot = await getMarketsCollection()
    .where("category", "==", category)
    .where("active", "==", true)
    .get();

  return snapshot.docs.map((doc) => doc.data());
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
  let created = 0;
  let updated = 0;

  // Process in batches of 500 (Firestore limit)
  const batchSize = 500;
  for (let i = 0; i < markets.length; i += batchSize) {
    const batch = markets.slice(i, i + batchSize);
    const results = await Promise.all(batch.map((m) => upsertMarket(m)));
    created += results.filter((r) => r).length;
    updated += results.filter((r) => !r).length;
  }

  return { created, updated };
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

  const markets = snapshot.docs
    .map((doc) => doc.data())
    .filter(
      (m) =>
        m.question.toLowerCase().includes(lowerQuery) ||
        m.description.toLowerCase().includes(lowerQuery)
    )
    .slice(0, limit);

  return markets;
}
