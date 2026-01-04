import { Timestamp } from "firebase-admin/firestore";
import { getAlertsCollection } from "../collections";
import type { Alert, NewAlert } from "../schema";

/**
 * Get an alert by ID
 */
export async function getAlert(id: string): Promise<Alert | null> {
  const doc = await getAlertsCollection().doc(id).get();
  const data = doc.data();
  if (!doc.exists || !data) {
    return null;
  }
  return data;
}

/**
 * Get alerts for a market, ordered by score descending
 */
export async function getAlertsByMarket(
  marketId: string,
  options: { limit?: number; minScore?: number } = {}
): Promise<Alert[]> {
  const { limit = 100, minScore } = options;

  const query = getAlertsCollection().where("marketId", "==", marketId).orderBy("score", "desc");

  // Note: Firestore stores score as string, so comparison may not work as expected
  // Consider storing score as number for proper ordering

  const snapshot = await query.limit(limit).get();
  let alerts = snapshot.docs.map((doc) => doc.data());

  if (minScore !== undefined) {
    alerts = alerts.filter((a) => parseFloat(a.score) >= minScore);
  }

  return alerts;
}

/**
 * Get alerts for a wallet, ordered by creation time descending
 */
export async function getAlertsByWallet(
  wallet: string,
  options: { limit?: number } = {}
): Promise<Alert[]> {
  const { limit = 100 } = options;

  const snapshot = await getAlertsCollection()
    .where("wallet", "==", wallet)
    .orderBy("createdAt", "desc")
    .limit(limit)
    .get();

  return snapshot.docs.map((doc) => doc.data());
}

/**
 * Get recent alerts, ordered by creation time descending
 */
export async function getRecentAlerts(
  options: {
    limit?: number;
    afterTimestamp?: Timestamp;
    minScore?: number;
  } = {}
): Promise<Alert[]> {
  const { limit = 100, afterTimestamp, minScore } = options;

  let query = getAlertsCollection().orderBy("createdAt", "desc");

  if (afterTimestamp) {
    query = query.where("createdAt", "<", afterTimestamp);
  }

  const snapshot = await query.limit(limit).get();
  let alerts = snapshot.docs.map((doc) => doc.data());

  if (minScore !== undefined) {
    alerts = alerts.filter((a) => parseFloat(a.score) >= minScore);
  }

  return alerts;
}

/**
 * Get high-score alerts above a threshold
 */
export async function getHighScoreAlerts(
  minScore: number,
  options: { limit?: number; windowMs?: number } = {}
): Promise<Alert[]> {
  const { limit = 100, windowMs } = options;

  let query = getAlertsCollection().orderBy("createdAt", "desc");

  if (windowMs) {
    const cutoff = Timestamp.fromMillis(Date.now() - windowMs);
    query = query.where("createdAt", ">=", cutoff);
  }

  const snapshot = await query.limit(limit * 2).get();

  return snapshot.docs
    .map((doc) => doc.data())
    .filter((a) => parseFloat(a.score) >= minScore)
    .slice(0, limit);
}

/**
 * Check if an alert already exists for a trade
 * Used for deduplication
 */
export async function alertExistsForTrade(tradeId: string): Promise<boolean> {
  const snapshot = await getAlertsCollection().where("tradeId", "==", tradeId).limit(1).get();

  return !snapshot.empty;
}

/**
 * Create a new alert
 * Alerts are immutable once created
 */
export async function createAlert(alert: NewAlert): Promise<string> {
  const collection = getAlertsCollection();
  const docRef = collection.doc();

  const newAlert: Alert = {
    id: docRef.id,
    ...alert,
    createdAt: alert.createdAt ?? Timestamp.now(),
  };

  await docRef.set(newAlert);
  return docRef.id;
}

/**
 * Create alert if not already exists for trade
 * Returns the alert ID if created, null if already exists
 */
export async function createAlertIfNotExists(alert: NewAlert): Promise<string | null> {
  const exists = await alertExistsForTrade(alert.tradeId);
  if (exists) {
    return null;
  }
  return createAlert(alert);
}

/**
 * Batch create alerts
 * Skips alerts for trades that already have alerts
 * Returns list of created IDs
 */
export async function batchCreateAlerts(alerts: NewAlert[]): Promise<string[]> {
  const ids: string[] = [];

  for (const alert of alerts) {
    const id = await createAlertIfNotExists(alert);
    if (id) {
      ids.push(id);
    }
  }

  return ids;
}

/**
 * Get alert count by market
 */
export async function getAlertCountByMarket(marketId: string): Promise<number> {
  // Note: For large collections, consider using a counter document
  const snapshot = await getAlertsCollection().where("marketId", "==", marketId).get();

  return snapshot.size;
}

/**
 * Get alert count by wallet
 */
export async function getAlertCountByWallet(wallet: string): Promise<number> {
  const snapshot = await getAlertsCollection().where("wallet", "==", wallet).get();

  return snapshot.size;
}

/**
 * Get alert statistics for a time window
 */
export async function getAlertStats(windowMs: number): Promise<{
  total: number;
  averageScore: string;
  maxScore: string;
}> {
  const cutoff = Timestamp.fromMillis(Date.now() - windowMs);

  const snapshot = await getAlertsCollection().where("createdAt", ">=", cutoff).get();

  if (snapshot.empty) {
    return { total: 0, averageScore: "0", maxScore: "0" };
  }

  const alerts = snapshot.docs.map((doc) => doc.data());
  const scores = alerts.map((a) => parseFloat(a.score));

  const total = alerts.length;
  const averageScore = (scores.reduce((sum, s) => sum + s, 0) / total).toString();
  const maxScore = Math.max(...scores).toString();

  return { total, averageScore, maxScore };
}
