import { Timestamp } from "firebase-admin/firestore";
import { getDb } from "../client";
import { calculateWeightedAverage, isStale as isStaleUtil } from "../utils/calculations";
import { batchDeleteFromSnapshot } from "../utils/firestore";

/**
 * Baseline document for caching rolling statistics
 * Stored in a separate 'baselines' collection
 */
export interface Baseline {
  /** Composite key: {type}:{targetId} */
  id: string;
  /** Baseline type (e.g., 'trade_size', 'spread', 'volume') */
  type: string;
  /** Target entity ID (marketId, tokenId, etc.) */
  targetId: string;
  /** Cached baseline value */
  value: string;
  /** Sample count used to compute baseline */
  sampleCount: number;
  /** Start of the window */
  windowStart: Timestamp;
  /** End of the window / last update */
  windowEnd: Timestamp;
  /** Last computation time */
  updatedAt: Timestamp;
}

/**
 * Input for creating/updating a baseline
 */
export interface NewBaseline {
  type: string;
  targetId: string;
  value: string;
  sampleCount: number;
  windowStart: Timestamp;
  windowEnd: Timestamp;
}

const BASELINES_COLLECTION = "baselines";

/**
 * Get baselines collection reference
 */
function getBaselinesCollection() {
  return getDb().collection(BASELINES_COLLECTION);
}

/**
 * Create composite ID for baseline
 */
function createBaselineId(type: string, targetId: string): string {
  return `${type}:${targetId}`;
}

/**
 * Get a baseline by type and target ID
 */
export async function getBaseline(type: string, targetId: string): Promise<Baseline | null> {
  const id = createBaselineId(type, targetId);
  const doc = await getBaselinesCollection().doc(id).get();

  if (!doc.exists) {
    return null;
  }

  return doc.data() as Baseline;
}

/**
 * Get all baselines for a target
 */
export async function getBaselinesForTarget(targetId: string): Promise<Baseline[]> {
  const snapshot = await getBaselinesCollection().where("targetId", "==", targetId).get();

  return snapshot.docs.map((doc) => doc.data() as Baseline);
}

/**
 * Get all baselines of a specific type
 */
export async function getBaselinesByType(type: string): Promise<Baseline[]> {
  const snapshot = await getBaselinesCollection().where("type", "==", type).get();

  return snapshot.docs.map((doc) => doc.data() as Baseline);
}

/**
 * Upsert a baseline (create or update)
 */
export async function upsertBaseline(baseline: NewBaseline): Promise<void> {
  const id = createBaselineId(baseline.type, baseline.targetId);
  const now = Timestamp.now();

  const doc: Baseline = {
    id,
    ...baseline,
    updatedAt: now,
  };

  await getBaselinesCollection().doc(id).set(doc);
}

/**
 * Update baseline value incrementally
 * Useful for streaming updates
 */
export async function updateBaselineIncremental(
  type: string,
  targetId: string,
  newValue: number,
  newSampleCount: number
): Promise<void> {
  const existing = await getBaseline(type, targetId);
  const now = Timestamp.now();

  if (!existing) {
    // Create new baseline
    await upsertBaseline({
      type,
      targetId,
      value: newValue.toString(),
      sampleCount: newSampleCount,
      windowStart: now,
      windowEnd: now,
    });
    return;
  }

  // Calculate weighted average with existing baseline
  const existingValue = parseFloat(existing.value);
  const totalSamples = existing.sampleCount + newSampleCount;

  const weightedAvg = calculateWeightedAverage(
    existingValue,
    existing.sampleCount,
    newValue,
    newSampleCount
  );

  await upsertBaseline({
    type,
    targetId,
    value: weightedAvg.toString(),
    sampleCount: totalSamples,
    windowStart: existing.windowStart,
    windowEnd: now,
  });
}

/**
 * Check if baseline is stale (older than maxAge)
 */
export async function isBaselineStale(
  type: string,
  targetId: string,
  maxAgeMs: number
): Promise<boolean> {
  const baseline = await getBaseline(type, targetId);

  if (!baseline) {
    return true;
  }

  return isStaleUtil(baseline.updatedAt.toMillis(), Date.now(), maxAgeMs);
}

/**
 * Delete a baseline
 */
export async function deleteBaseline(type: string, targetId: string): Promise<void> {
  const id = createBaselineId(type, targetId);
  await getBaselinesCollection().doc(id).delete();
}

/**
 * Delete all baselines for a target
 */
export async function deleteBaselinesForTarget(targetId: string): Promise<number> {
  const snapshot = await getBaselinesCollection().where("targetId", "==", targetId).get();
  return batchDeleteFromSnapshot(snapshot);
}

/**
 * Clean up stale baselines
 */
export async function cleanupStaleBaselines(maxAgeMs: number): Promise<number> {
  const cutoff = Timestamp.fromMillis(Date.now() - maxAgeMs);

  const snapshot = await getBaselinesCollection()
    .where("updatedAt", "<", cutoff)
    .limit(500) // Process in batches
    .get();

  return batchDeleteFromSnapshot(snapshot);
}

// Common baseline types
export const BASELINE_TYPES = {
  TRADE_SIZE_MEDIAN: "trade_size_median",
  TRADE_VOLUME_24H: "trade_volume_24h",
  SPREAD_AVERAGE: "spread_average",
  DEPTH_AVERAGE: "depth_average",
  TRADE_COUNT_24H: "trade_count_24h",
} as const;
