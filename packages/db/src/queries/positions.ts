import { Timestamp } from "firebase-admin/firestore";
import { getWalletPositionsCollection } from "../collections";
import type { WalletPosition, NewWalletPosition } from "../schema";
import { calculateRampSpeed, calculateConcentration } from "../utils/calculations";
import { processBatches, extractDocsData, getFirstDocOrNull } from "../utils/firestore";

/**
 * Get the latest position for a wallet in a specific token
 */
export async function getLatestPosition(
  wallet: string,
  tokenId: string
): Promise<WalletPosition | null> {
  const snapshot = await getWalletPositionsCollection()
    .where("wallet", "==", wallet)
    .where("tokenId", "==", tokenId)
    .orderBy("timestamp", "desc")
    .limit(1)
    .get();

  return getFirstDocOrNull(snapshot);
}

/**
 * Get all current positions for a wallet
 * Returns the latest position snapshot for each token
 */
export async function getWalletPositions(wallet: string): Promise<WalletPosition[]> {
  const snapshot = await getWalletPositionsCollection()
    .where("wallet", "==", wallet)
    .orderBy("timestamp", "desc")
    .get();

  // Deduplicate to get only the latest position per token
  const positionsByToken = new Map<string, WalletPosition>();

  snapshot.docs.forEach((doc) => {
    const position = doc.data();
    if (!positionsByToken.has(position.tokenId)) {
      positionsByToken.set(position.tokenId, position);
    }
  });

  return Array.from(positionsByToken.values());
}

/**
 * Get position history for a wallet in a specific token
 */
export async function getPositionHistory(
  wallet: string,
  tokenId: string,
  options: { limit?: number; windowMs?: number } = {}
): Promise<WalletPosition[]> {
  const { limit = 100, windowMs } = options;

  let query = getWalletPositionsCollection()
    .where("wallet", "==", wallet)
    .where("tokenId", "==", tokenId)
    .orderBy("timestamp", "desc");

  if (windowMs) {
    const cutoff = Timestamp.fromMillis(Date.now() - windowMs);
    query = query.where("timestamp", ">=", cutoff);
  }

  const snapshot = await query.limit(limit).get();
  return extractDocsData(snapshot);
}

/**
 * Get top holders for a market
 * Note: Requires client-side aggregation due to Firestore limitations
 */
export async function getTopHolders(
  marketId: string,
  options: { limit?: number } = {}
): Promise<{ wallet: string; totalPosition: string }[]> {
  const { limit = 20 } = options;

  const snapshot = await getWalletPositionsCollection()
    .where("marketId", "==", marketId)
    .orderBy("timestamp", "desc")
    .get();

  // Aggregate positions by wallet (latest per token)
  const walletPositions = new Map<string, Map<string, number>>();

  snapshot.docs.forEach((doc) => {
    const pos = doc.data();

    if (!walletPositions.has(pos.wallet)) {
      walletPositions.set(pos.wallet, new Map());
    }

    const tokenPositions = walletPositions.get(pos.wallet);
    if (tokenPositions && !tokenPositions.has(pos.tokenId)) {
      tokenPositions.set(pos.tokenId, parseFloat(pos.position));
    }
  });

  // Calculate total position per wallet
  const totals = Array.from(walletPositions.entries()).map(([wallet, tokens]) => {
    const total = Array.from(tokens.values()).reduce((sum, pos) => sum + pos, 0);
    return { wallet, totalPosition: total.toString() };
  });

  // Sort by total position descending and limit
  return totals
    .sort((a, b) => parseFloat(b.totalPosition) - parseFloat(a.totalPosition))
    .slice(0, limit);
}

/**
 * Insert a new position snapshot
 */
export async function insertPositionSnapshot(position: NewWalletPosition): Promise<string> {
  const collection = getWalletPositionsCollection();
  const docRef = collection.doc();

  const newPosition: WalletPosition = {
    id: docRef.id,
    ...position,
  };

  await docRef.set(newPosition);
  return docRef.id;
}

/**
 * Batch insert position snapshots
 * Returns list of created IDs
 */
export async function batchInsertPositionSnapshots(
  positions: NewWalletPosition[]
): Promise<string[]> {
  return processBatches(positions, insertPositionSnapshot);
}

/**
 * Calculate position ramp speed for a wallet
 * Returns the rate of position change over the given window
 */
export async function getPositionRampSpeed(
  wallet: string,
  tokenId: string,
  windowMs: number
): Promise<{ rampSpeed: string; positionChange: string } | null> {
  const history = await getPositionHistory(wallet, tokenId, { windowMs });

  const latest = history[0];
  const oldest = history[history.length - 1];

  if (history.length < 2 || !latest || !oldest) {
    return null;
  }

  const startValue = parseFloat(oldest.position);
  const endValue = parseFloat(latest.position);
  const timeDelta = latest.timestamp.toMillis() - oldest.timestamp.toMillis();

  const rampSpeed = calculateRampSpeed(startValue, endValue, timeDelta);

  if (rampSpeed === null) {
    return null;
  }

  return {
    rampSpeed: rampSpeed.toString(),
    positionChange: (endValue - startValue).toString(),
  };
}

/**
 * Get position concentration for a wallet in a market
 * Returns the wallet's position as a fraction of total market positions
 */
export async function getPositionConcentration(
  wallet: string,
  marketId: string
): Promise<string | null> {
  const topHolders = await getTopHolders(marketId, { limit: 1000 });

  if (topHolders.length === 0) {
    return null;
  }

  const walletHolder = topHolders.find((h) => h.wallet === wallet);
  if (!walletHolder) {
    return "0";
  }

  const walletPosition = parseFloat(walletHolder.totalPosition);
  const totalMarket = topHolders.reduce((sum, h) => sum + parseFloat(h.totalPosition), 0);

  const concentration = calculateConcentration(walletPosition, totalMarket);

  return concentration !== null ? concentration.toString() : null;
}
