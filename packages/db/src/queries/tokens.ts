import { Timestamp } from "firebase-admin/firestore";
import { getTokensCollection } from "../collections";
import type { Token, NewToken } from "../schema";

/**
 * Get a token by ID
 */
export async function getToken(id: string): Promise<Token | null> {
  const doc = await getTokensCollection().doc(id).get();
  const data = doc.data();
  if (!doc.exists || !data) {
    return null;
  }
  return data;
}

/**
 * Get tokens by market ID
 */
export async function getTokensByMarket(marketId: string): Promise<Token[]> {
  const snapshot = await getTokensCollection().where("marketId", "==", marketId).get();

  return snapshot.docs.map((doc) => doc.data());
}

/**
 * Get multiple tokens by IDs
 */
export async function getTokens(ids: string[]): Promise<Token[]> {
  if (ids.length === 0) {
    return [];
  }

  const collection = getTokensCollection();
  const docs = await Promise.all(ids.map((id) => collection.doc(id).get()));

  return docs
    .filter((doc) => doc.exists)
    .map((doc) => doc.data())
    .filter((data): data is Token => data !== undefined);
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
  let created = 0;
  let updated = 0;

  // Process in batches of 500 (Firestore limit)
  const batchSize = 500;
  for (let i = 0; i < tokens.length; i += batchSize) {
    const batch = tokens.slice(i, i + batchSize);
    const results = await Promise.all(batch.map((t) => upsertToken(t)));
    created += results.filter((r) => r).length;
    updated += results.filter((r) => !r).length;
  }

  return { created, updated };
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

  const batch = getTokensCollection().firestore.batch();
  snapshot.docs.forEach((doc) => {
    batch.delete(doc.ref);
  });

  await batch.commit();
  return snapshot.docs.length;
}
