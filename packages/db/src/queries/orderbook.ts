import { Timestamp } from "firebase-admin/firestore";
import { getOrderbookSnapshotsCollection } from "../collections";
import type { OrderbookSnapshot, NewOrderbookSnapshot } from "../schema";

/**
 * Get the latest orderbook snapshot for a token
 */
export async function getLatestOrderbookSnapshot(
  tokenId: string
): Promise<OrderbookSnapshot | null> {
  const snapshot = await getOrderbookSnapshotsCollection()
    .where("tokenId", "==", tokenId)
    .orderBy("timestamp", "desc")
    .limit(1)
    .get();

  const firstDoc = snapshot.docs[0];
  if (snapshot.empty || !firstDoc) {
    return null;
  }

  return firstDoc.data();
}

/**
 * Get orderbook snapshots for a token within a time window
 */
export async function getOrderbookSnapshots(
  tokenId: string,
  options: { limit?: number; windowMs?: number } = {}
): Promise<OrderbookSnapshot[]> {
  const { limit = 100, windowMs } = options;

  let query = getOrderbookSnapshotsCollection()
    .where("tokenId", "==", tokenId)
    .orderBy("timestamp", "desc");

  if (windowMs) {
    const cutoff = Timestamp.fromMillis(Date.now() - windowMs);
    query = query.where("timestamp", ">=", cutoff);
  }

  const snapshot = await query.limit(limit).get();
  return snapshot.docs.map((doc) => doc.data());
}

/**
 * Get orderbook snapshots for a market (all tokens)
 */
export async function getOrderbookSnapshotsByMarket(
  marketId: string,
  options: { limit?: number } = {}
): Promise<OrderbookSnapshot[]> {
  const { limit = 100 } = options;

  const snapshot = await getOrderbookSnapshotsCollection()
    .where("marketId", "==", marketId)
    .orderBy("timestamp", "desc")
    .limit(limit)
    .get();

  return snapshot.docs.map((doc) => doc.data());
}

/**
 * Insert a new orderbook snapshot
 */
export async function insertOrderbookSnapshot(snapshot: NewOrderbookSnapshot): Promise<string> {
  const collection = getOrderbookSnapshotsCollection();
  const docRef = collection.doc();

  const newSnapshot: OrderbookSnapshot = {
    id: docRef.id,
    ...snapshot,
  };

  await docRef.set(newSnapshot);
  return docRef.id;
}

/**
 * Batch insert orderbook snapshots
 * Returns list of created IDs
 */
export async function batchInsertOrderbookSnapshots(
  snapshots: NewOrderbookSnapshot[]
): Promise<string[]> {
  const ids: string[] = [];

  // Process in batches of 500 (Firestore limit)
  const batchSize = 500;
  for (let i = 0; i < snapshots.length; i += batchSize) {
    const batchItems = snapshots.slice(i, i + batchSize);
    const batchIds = await Promise.all(batchItems.map((s) => insertOrderbookSnapshot(s)));
    ids.push(...batchIds);
  }

  return ids;
}

/**
 * Get average spread for a token over a time window
 */
export async function getAverageSpread(tokenId: string, windowMs: number): Promise<string | null> {
  const snapshots = await getOrderbookSnapshots(tokenId, { windowMs });

  if (snapshots.length === 0) {
    return null;
  }

  const spreads = snapshots.map((s) => parseFloat(s.spread));
  const avgSpread = spreads.reduce((sum, s) => sum + s, 0) / spreads.length;

  return avgSpread.toString();
}

/**
 * Get available depth (bid + ask) for a token
 * Returns the latest snapshot's total depth
 */
export async function getAvailableDepth(
  tokenId: string
): Promise<{ bidDepth: string; askDepth: string; total: string } | null> {
  const snapshot = await getLatestOrderbookSnapshot(tokenId);

  if (!snapshot) {
    return null;
  }

  const bidDepth = parseFloat(snapshot.bidDepth);
  const askDepth = parseFloat(snapshot.askDepth);

  return {
    bidDepth: snapshot.bidDepth,
    askDepth: snapshot.askDepth,
    total: (bidDepth + askDepth).toString(),
  };
}

/**
 * Clean up old orderbook snapshots
 * Keeps only snapshots within the retention period
 */
export async function cleanupOldSnapshots(retentionMs: number): Promise<number> {
  const cutoff = Timestamp.fromMillis(Date.now() - retentionMs);

  const snapshot = await getOrderbookSnapshotsCollection()
    .where("timestamp", "<", cutoff)
    .limit(500) // Process in batches
    .get();

  if (snapshot.empty) {
    return 0;
  }

  const batch = getOrderbookSnapshotsCollection().firestore.batch();
  snapshot.docs.forEach((doc) => {
    batch.delete(doc.ref);
  });

  await batch.commit();
  return snapshot.docs.length;
}
