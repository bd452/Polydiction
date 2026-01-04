import { Timestamp } from "firebase-admin/firestore";
import { getTokensCollection } from "../collections";
import type { Token, NewToken } from "../schema";
import {
  getDocumentById,
  getDocumentsByIds,
  processBatches,
  countBatchResults,
  extractDocsData,
  batchDeleteFromSnapshot,
} from "../utils/firestore";

/**
 * Get a token by ID
 */
export async function getToken(id: string): Promise<Token | null> {
  return getDocumentById(getTokensCollection(), id);
}

/**
 * Get tokens by market ID
 */
export async function getTokensByMarket(marketId: string): Promise<Token[]> {
  const snapshot = await getTokensCollection().where("marketId", "==", marketId).get();

  return extractDocsData(snapshot);
}

/**
 * Get multiple tokens by IDs
 */
export async function getTokens(ids: string[]): Promise<Token[]> {
  return getDocumentsByIds(getTokensCollection(), ids);
}

/**
 * Upsert a token (create or update)
 * Returns true if created, false if updated
 */
export async function upsertToken(token: NewToken): Promise<boolean> {
  const collection = getTokensCollection();
  const docRef = collection.doc(token.id);
  const existingDoc = await docRef.get();

  const now = Timestamp.now();

  if (!existingDoc.exists) {
    // Create new token
    const newToken: Token = {
      ...token,
      updatedAt: token.updatedAt ?? now,
    };
    await docRef.set(newToken);
    return true;
  } else {
    // Update existing token
    await docRef.update({
      marketId: token.marketId,
      outcome: token.outcome,
      price: token.price,
      raw: token.raw,
      updatedAt: now,
    });
    return false;
  }
}

/**
 * Batch upsert tokens
 * Returns count of created and updated tokens
 */
export async function batchUpsertTokens(
  tokens: NewToken[]
): Promise<{ created: number; updated: number }> {
  const results = await processBatches(tokens, upsertToken);
  return countBatchResults(results);
}

/**
 * Update token price
 */
export async function updateTokenPrice(id: string, price: string): Promise<void> {
  await getTokensCollection().doc(id).update({
    price,
    updatedAt: Timestamp.now(),
  });
}

/**
 * Delete tokens by market ID
 * Used when a market is removed
 */
export async function deleteTokensByMarket(marketId: string): Promise<number> {
  const snapshot = await getTokensCollection().where("marketId", "==", marketId).get();
  return batchDeleteFromSnapshot(snapshot);
}
