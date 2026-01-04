import type {
  DecimalString,
  MarketId,
  RawPayload,
  Timestamp,
  TokenId,
} from "./common";

/**
 * Market category for classification
 */
export type MarketCategory =
  | "politics"
  | "sports"
  | "crypto"
  | "entertainment"
  | "science"
  | "current_events"
  | "other";

/**
 * Market status
 */
export type MarketStatus = "active" | "closed" | "resolved";

/**
 * A prediction market on Polymarket
 */
export interface Market {
  id: MarketId;
  slug: string;
  question: string;
  description: string;
  category: MarketCategory;
  endDate: Timestamp | null;
  status: MarketStatus;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  raw: RawPayload;
}

/**
 * A token representing an outcome in a market
 */
export interface Token {
  id: TokenId;
  marketId: MarketId;
  outcome: string;
  price: DecimalString;
  updatedAt: Timestamp;
  raw: RawPayload;
}

/**
 * Orderbook snapshot for a token
 */
export interface OrderbookSnapshot {
  id: number;
  marketId: MarketId;
  tokenId: TokenId;
  bestBid: DecimalString;
  bestAsk: DecimalString;
  bidDepth: DecimalString;
  askDepth: DecimalString;
  spread: DecimalString;
  timestamp: Timestamp;
  raw?: RawPayload;
}

/**
 * Market with its tokens
 */
export interface MarketWithTokens extends Market {
  tokens: Token[];
}
