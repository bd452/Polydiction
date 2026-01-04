import type { DecimalString, MarketId, RawPayload, Timestamp, TokenId } from "./common";

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
 * A prediction market on Polymarket
 */
export interface Market {
  id: MarketId;
  slug: string;
  question: string;
  description: string;
  category: MarketCategory;
  endDate: Timestamp | null;
  active: boolean;
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

// ============================================================================
// Gamma API Types (External API Response Shapes)
// ============================================================================

/**
 * Token/outcome as returned by Polymarket Gamma API
 */
export interface GammaToken {
  token_id: string;
  outcome: string;
  price?: string;
  winner?: boolean;
}

/**
 * Market as returned by Polymarket Gamma API
 * Note: This is a subset of commonly used fields; full response stored in raw
 */
export interface GammaMarket {
  condition_id: string;
  question_id?: string;
  slug?: string;
  question: string;
  description?: string;
  category?: string;
  end_date_iso?: string;
  game_start_time?: string;
  active: boolean;
  closed: boolean;
  archived?: boolean;
  tokens: GammaToken[];
  /** Additional fields from API response */
  [key: string]: unknown;
}

/**
 * Paginated response from Gamma API
 */
export interface GammaMarketsResponse {
  data?: GammaMarket[];
  count?: number;
  next_cursor?: string;
}

// ============================================================================
// CLOB API Types (External API Response Shapes)
// ============================================================================

/**
 * Price level in an orderbook
 */
export interface CLOBOrderbookLevel {
  /** Price at this level */
  price: string;
  /** Size/quantity at this level */
  size: string;
}

/**
 * Orderbook as returned by Polymarket CLOB API
 */
export interface CLOBOrderbook {
  /** Market condition ID */
  market: string;
  /** Token/asset ID */
  asset_id: string;
  /** Hash of the orderbook state */
  hash: string;
  /** Timestamp of the orderbook snapshot */
  timestamp: string;
  /** Bid levels (sorted by price descending) */
  bids: CLOBOrderbookLevel[];
  /** Ask levels (sorted by price ascending) */
  asks: CLOBOrderbookLevel[];
}

/**
 * Response from CLOB book endpoint
 */
export interface CLOBBookResponse {
  /** Orderbook data */
  data?: CLOBOrderbook;
  /** Market ID */
  market?: string;
  /** Asset ID */
  asset_id?: string;
}

/**
 * Options for fetching orderbook from CLOB API
 */
export interface FetchOrderbookOptions {
  /** Token/asset ID */
  tokenId: string;
}
