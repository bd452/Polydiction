import type {
  DecimalString,
  MarketId,
  RawPayload,
  Timestamp,
  TokenId,
  TradeId,
  WalletAddress,
} from "./common";

/**
 * Trade side
 */
export type TradeSide = "BUY" | "SELL";

/**
 * A trade executed on Polymarket
 */
export interface Trade {
  id: TradeId;
  marketId: MarketId;
  tokenId: TokenId;
  maker: WalletAddress;
  taker: WalletAddress;
  side: TradeSide;
  size: DecimalString;
  price: DecimalString;
  timestamp: Timestamp;
  createdAt: Timestamp;
  raw: RawPayload;
}

// ============================================================================
// CLOB API Types (External API Response Shapes)
// ============================================================================

/**
 * Trade as returned by Polymarket CLOB API
 */
export interface CLOBTrade {
  /** Unique trade ID */
  id: string;
  /** Taker order ID */
  taker_order_id: string;
  /** Market/condition ID */
  market: string;
  /** Token/asset ID */
  asset_id: string;
  /** Trade side from taker perspective: buy or sell */
  side: "buy" | "sell";
  /** Trade size */
  size: string;
  /** Fee rate */
  fee_rate_bps: string;
  /** Trade price */
  price: string;
  /** Trade status */
  status: "MATCHED" | "MINED" | "CONFIRMED" | "RETRYING";
  /** Match time (ISO 8601 string) */
  match_time: string;
  /** Last update time (ISO 8601 string) */
  last_update: string;
  /** Outcome (YES/NO) */
  outcome: string;
  /** Bucket index */
  bucket_index: number;
  /** Owner (wallet address) */
  owner: string;
  /** Maker address */
  maker_address: string;
  /** Transaction hash (when mined) */
  transaction_hash?: string;
  /** Type (Trade, etc.) */
  type?: string;
}

/**
 * Response from CLOB trades endpoint
 */
export interface CLOBTradesResponse {
  /** Array of trades */
  data?: CLOBTrade[];
  /** Pagination cursor */
  next_cursor?: string;
}

/**
 * Options for fetching trades from CLOB API
 */
export interface FetchTradesOptions {
  /** Market/condition ID to filter by */
  marketId?: string;
  /** Token/asset ID to filter by */
  assetId?: string;
  /** Maker address to filter by */
  maker?: string;
  /** Pagination cursor */
  cursor?: string;
  /** Number of results per page (default: 100, max: 500) */
  limit?: number;
  /** Only fetch trades after this timestamp (ISO 8601) */
  after?: string;
  /** Only fetch trades before this timestamp (ISO 8601) */
  before?: string;
}

/**
 * Wallet position in a market
 */
export interface WalletPosition {
  id: number;
  wallet: WalletAddress;
  marketId: MarketId;
  tokenId: TokenId;
  position: DecimalString;
  avgPrice: DecimalString | null;
  timestamp: Timestamp;
}

/**
 * Trade with computed USD value
 */
export interface TradeWithValue extends Trade {
  usdValue: DecimalString;
}
