import type { CollectionReference, DocumentData } from "firebase-admin/firestore";
import { getDb } from "./client";
import type { Market, Token, Trade, OrderbookSnapshot, WalletPosition, Alert } from "./schema";

/**
 * Collection names as constants
 */
export const COLLECTION_NAMES = {
  markets: "markets",
  tokens: "tokens",
  trades: "trades",
  orderbookSnapshots: "orderbookSnapshots",
  walletPositions: "walletPositions",
  alerts: "alerts",
} as const;

/**
 * Type-safe collection reference helper
 */
function getCollection<T extends DocumentData>(collectionName: string): CollectionReference<T> {
  return getDb().collection(collectionName) as CollectionReference<T>;
}

/**
 * Markets collection reference
 * Contains prediction markets from Polymarket
 */
export function getMarketsCollection(): CollectionReference<Market> {
  return getCollection<Market>(COLLECTION_NAMES.markets);
}

/**
 * Tokens collection reference
 * Contains outcomes within markets
 */
export function getTokensCollection(): CollectionReference<Token> {
  return getCollection<Token>(COLLECTION_NAMES.tokens);
}

/**
 * Trades collection reference
 * Contains executed trades
 */
export function getTradesCollection(): CollectionReference<Trade> {
  return getCollection<Trade>(COLLECTION_NAMES.trades);
}

/**
 * Orderbook snapshots collection reference
 * Contains point-in-time orderbook state
 */
export function getOrderbookSnapshotsCollection(): CollectionReference<OrderbookSnapshot> {
  return getCollection<OrderbookSnapshot>(COLLECTION_NAMES.orderbookSnapshots);
}

/**
 * Wallet positions collection reference
 * Contains position snapshots per wallet
 */
export function getWalletPositionsCollection(): CollectionReference<WalletPosition> {
  return getCollection<WalletPosition>(COLLECTION_NAMES.walletPositions);
}

/**
 * Alerts collection reference
 * Contains detected anomalies (immutable log)
 */
export function getAlertsCollection(): CollectionReference<Alert> {
  return getCollection<Alert>(COLLECTION_NAMES.alerts);
}
