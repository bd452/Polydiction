import type {
  CollectionReference,
  DocumentData,
  DocumentSnapshot,
  QuerySnapshot,
  WriteBatch,
} from "firebase-admin/firestore";

/**
 * Default batch size for Firestore operations
 * Firestore has a limit of 500 operations per batch
 */
export const DEFAULT_BATCH_SIZE = 500;

/**
 * Get a document by ID from a collection
 * Returns null if document doesn't exist
 */
export async function getDocumentById<T extends DocumentData>(
  collection: CollectionReference<T>,
  id: string
): Promise<T | null> {
  const doc = await collection.doc(id).get();
  const data = doc.data();
  if (!doc.exists || !data) {
    return null;
  }
  return data;
}

/**
 * Get multiple documents by IDs from a collection
 * Filters out non-existent documents
 */
export async function getDocumentsByIds<T extends DocumentData>(
  collection: CollectionReference<T>,
  ids: string[]
): Promise<T[]> {
  if (ids.length === 0) {
    return [];
  }

  const docs = await Promise.all(ids.map((id) => collection.doc(id).get()));

  return docs
    .filter((doc): doc is DocumentSnapshot<T> => doc.exists)
    .map((doc) => doc.data())
    .filter((data): data is T => data !== undefined);
}

/**
 * Process items in batches with an async operation
 * Returns array of results from each batch operation
 */
export async function processBatches<T, R>(
  items: T[],
  operation: (item: T) => Promise<R>,
  batchSize: number = DEFAULT_BATCH_SIZE
): Promise<R[]> {
  const results: R[] = [];

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(operation));
    results.push(...batchResults);
  }

  return results;
}

/**
 * Count results from batch boolean operations
 * Useful for upsert operations that return true/false
 */
export function countBatchResults(results: boolean[]): { created: number; updated: number } {
  return {
    created: results.filter((r) => r).length,
    updated: results.filter((r) => !r).length,
  };
}

/**
 * Delete all documents from a query snapshot using a batch operation
 * Returns the number of deleted documents
 */
export async function batchDeleteFromSnapshot<T extends DocumentData>(
  snapshot: QuerySnapshot<T>
): Promise<number> {
  if (snapshot.empty) {
    return 0;
  }

  // Get the Firestore instance from the first document reference
  const firstDoc = snapshot.docs[0];
  if (!firstDoc) {
    return 0;
  }

  const batch: WriteBatch = firstDoc.ref.firestore.batch();
  snapshot.docs.forEach((doc) => {
    batch.delete(doc.ref);
  });

  await batch.commit();
  return snapshot.docs.length;
}

/**
 * Extract data from query snapshot documents
 */
export function extractDocsData<T extends DocumentData>(snapshot: QuerySnapshot<T>): T[] {
  return snapshot.docs.map((doc) => doc.data());
}

/**
 * Get first document from snapshot or null
 */
export function getFirstDocOrNull<T extends DocumentData>(snapshot: QuerySnapshot<T>): T | null {
  const firstDoc = snapshot.docs[0];
  if (snapshot.empty || !firstDoc) {
    return null;
  }
  return firstDoc.data();
}
