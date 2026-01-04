import type { Timestamp } from "firebase-admin/firestore";

/**
 * Firestore Document Interfaces for Polydiction
 *
 * Note: Decimal values are stored as strings to preserve precision.
 * Timestamps use Firestore's native Timestamp type.
 */

/**
 * Market document - prediction markets from Polymarket
 */
export interface Market {
  /** Document ID (condition_id) */
  id: string;
  /** URL-friendly identifier */
  slug: string;
  /** Market question */
  question: string;
  /** Full description */
  description: string;
  /** Market category */
  category: string;
  /** Market resolution date */
  endDate: Timestamp | null;
  /** Whether market is open */
  active: boolean;
  /** Full API response */
  raw: Record<string, unknown>;
  /** Record creation */
  createdAt: Timestamp;
  /** Last update */
  updatedAt: Timestamp;
}

/**
 * Input for creating a new Market document
 */
export interface NewMarket {
  id: string;
  slug: string;
  question: string;
  description: string;
  category: string;
  endDate?: Timestamp | null;
  active?: boolean;
  raw: Record<string, unknown>;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

/**
 * Token document - outcomes within markets
 */
export interface Token {
  /** Document ID (token_id) */
  id: string;
  /** Parent market ID */
  marketId: string;
  /** Outcome name (Yes/No/etc) */
  outcome: string;
  /** Current price (decimal as string) */
  price: string;
  /** Full API response */
  raw: Record<string, unknown>;
  /** Last update */
  updatedAt: Timestamp;
}

/**
 * Input for creating a new Token document
 */
export interface NewToken {
  id: string;
  marketId: string;
  outcome: string;
  price: string;
  raw: Record<string, unknown>;
  updatedAt?: Timestamp;
}

/**
 * Trade document - executed trades
 */
export interface Trade {
  /** Document ID (trade_id) */
  id: string;
  /** Market ID */
  marketId: string;
  /** Token ID */
  tokenId: string;
  /** Maker address */
  maker: string;
  /** Taker address */
  taker: string;
  /** BUY or SELL */
  side: string;
  /** Trade size (decimal as string) */
  size: string;
  /** Trade price (decimal as string) */
  price: string;
  /** Trade time */
  timestamp: Timestamp;
  /** Full API response */
  raw: Record<string, unknown>;
  /** Record creation */
  createdAt: Timestamp;
}

/**
 * Input for creating a new Trade document
 */
export interface NewTrade {
  id: string;
  marketId: string;
  tokenId: string;
  maker: string;
  taker: string;
  side: string;
  size: string;
  price: string;
  timestamp: Timestamp;
  raw: Record<string, unknown>;
  createdAt?: Timestamp;
}

/**
 * OrderbookSnapshot document - point-in-time orderbook state
 */
export interface OrderbookSnapshot {
  /** Auto-generated ID */
  id: string;
  /** Market ID */
  marketId: string;
  /** Token ID */
  tokenId: string;
  /** Top bid price (decimal as string) */
  bestBid: string;
  /** Top ask price (decimal as string) */
  bestAsk: string;
  /** Total bid liquidity (decimal as string) */
  bidDepth: string;
  /** Total ask liquidity (decimal as string) */
  askDepth: string;
  /** Bid-ask spread (decimal as string) */
  spread: string;
  /** Snapshot time */
  timestamp: Timestamp;
  /** Optional depth data */
  raw?: Record<string, unknown>;
}

/**
 * Input for creating a new OrderbookSnapshot document
 */
export interface NewOrderbookSnapshot {
  marketId: string;
  tokenId: string;
  bestBid: string;
  bestAsk: string;
  bidDepth: string;
  askDepth: string;
  spread: string;
  timestamp: Timestamp;
  raw?: Record<string, unknown>;
}

/**
 * WalletPosition document - position snapshots per wallet
 */
export interface WalletPosition {
  /** Auto-generated ID */
  id: string;
  /** Wallet address */
  wallet: string;
  /** Market ID */
  marketId: string;
  /** Token ID */
  tokenId: string;
  /** Position size (decimal as string) */
  position: string;
  /** Average entry price (decimal as string, optional) */
  avgPrice?: string;
  /** Snapshot time */
  timestamp: Timestamp;
}

/**
 * Input for creating a new WalletPosition document
 */
export interface NewWalletPosition {
  wallet: string;
  marketId: string;
  tokenId: string;
  position: string;
  avgPrice?: string;
  timestamp: Timestamp;
}

/**
 * Alert reason - contributing factor to anomaly score
 */
export interface AlertReason {
  /** Feature name */
  feature: string;
  /** Reason description */
  description: string;
  /** Contribution to total score */
  contribution: number;
}

/**
 * Alert features - computed features at time of alert
 */
export interface AlertFeatures {
  tradeSizeVsMedian?: number;
  tradeSizeVsDepth?: number;
  aggressiveness?: number;
  walletBurst?: number;
  positionConcentration?: number;
  rampSpeed?: number;
  walletFreshness?: number;
  dollarValue?: number;
  [key: string]: number | undefined;
}

/**
 * Market state at time of alert
 */
export interface AlertMarketState {
  bestBid?: string;
  bestAsk?: string;
  spread?: string;
  bidDepth?: string;
  askDepth?: string;
  [key: string]: string | undefined;
}

/**
 * Alert document - detected anomalies (immutable log)
 */
export interface Alert {
  /** Auto-generated UUID */
  id: string;
  /** Market ID */
  marketId: string;
  /** Triggering trade ID */
  tradeId: string;
  /** Wallet flagged */
  wallet: string;
  /** Anomaly score (decimal as string) */
  score: string;
  /** Contributing factors */
  reasons: AlertReason[];
  /** Computed features */
  features: AlertFeatures;
  /** Market context at alert time */
  marketState: AlertMarketState;
  /** Alert creation (immutable) */
  createdAt: Timestamp;
}

/**
 * Input for creating a new Alert document
 */
export interface NewAlert {
  marketId: string;
  tradeId: string;
  wallet: string;
  score: string;
  reasons: AlertReason[];
  features: AlertFeatures;
  marketState: AlertMarketState;
  createdAt?: Timestamp;
}
