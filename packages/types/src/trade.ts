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
