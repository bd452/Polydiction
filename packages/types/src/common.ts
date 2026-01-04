/**
 * Common types used across the application
 */

/** ISO 8601 timestamp string */
export type Timestamp = string;

/** Ethereum-style wallet address */
export type WalletAddress = string;

/** Polymarket condition ID */
export type MarketId = string;

/** Polymarket token ID */
export type TokenId = string;

/** Trade ID from CLOB API */
export type TradeId = string;

/** UUID for internal entities */
export type UUID = string;

/** Decimal values stored as strings for precision */
export type DecimalString = string;

/** Raw JSON payload from external APIs */
export type RawPayload = Record<string, unknown>;

/** Pagination cursor */
export interface PaginationCursor {
  nextCursor?: string;
  hasMore: boolean;
}

/** Standard API response wrapper */
export interface ApiResponse<T> {
  data: T;
  pagination?: PaginationCursor;
  timestamp: Timestamp;
}

/** Error response */
export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}
