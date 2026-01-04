import {
  boolean,
  decimal,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Markets table - prediction markets from Polymarket
 */
export const markets = pgTable("markets", {
  id: text("id").primaryKey(), // condition_id
  slug: text("slug").notNull(),
  question: text("question").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(),
  endDate: timestamp("end_date", { withTimezone: true }),
  active: boolean("active").notNull().default(true),
  raw: jsonb("raw").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * Tokens table - outcomes within markets
 */
export const tokens = pgTable("tokens", {
  id: text("id").primaryKey(),
  marketId: text("market_id")
    .notNull()
    .references(() => markets.id),
  outcome: text("outcome").notNull(),
  price: decimal("price", { precision: 18, scale: 8 }).notNull(),
  raw: jsonb("raw").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * Trades table - executed trades
 */
export const trades = pgTable("trades", {
  id: text("id").primaryKey(),
  marketId: text("market_id")
    .notNull()
    .references(() => markets.id),
  tokenId: text("token_id")
    .notNull()
    .references(() => tokens.id),
  maker: text("maker").notNull(),
  taker: text("taker").notNull(),
  side: text("side").notNull(), // BUY or SELL
  size: decimal("size", { precision: 18, scale: 8 }).notNull(),
  price: decimal("price", { precision: 18, scale: 8 }).notNull(),
  timestamp: timestamp("timestamp", { withTimezone: true }).notNull(),
  raw: jsonb("raw").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * Orderbook snapshots table - point-in-time orderbook state
 */
export const orderbookSnapshots = pgTable("orderbook_snapshots", {
  id: serial("id").primaryKey(),
  marketId: text("market_id")
    .notNull()
    .references(() => markets.id),
  tokenId: text("token_id")
    .notNull()
    .references(() => tokens.id),
  bestBid: decimal("best_bid", { precision: 18, scale: 8 }).notNull(),
  bestAsk: decimal("best_ask", { precision: 18, scale: 8 }).notNull(),
  bidDepth: decimal("bid_depth", { precision: 18, scale: 8 }).notNull(),
  askDepth: decimal("ask_depth", { precision: 18, scale: 8 }).notNull(),
  spread: decimal("spread", { precision: 18, scale: 8 }).notNull(),
  timestamp: timestamp("timestamp", { withTimezone: true }).notNull(),
  raw: jsonb("raw"),
});

/**
 * Wallet positions table - position snapshots per wallet
 */
export const walletPositions = pgTable("wallet_positions", {
  id: serial("id").primaryKey(),
  wallet: text("wallet").notNull(),
  marketId: text("market_id")
    .notNull()
    .references(() => markets.id),
  tokenId: text("token_id")
    .notNull()
    .references(() => tokens.id),
  position: decimal("position", { precision: 18, scale: 8 }).notNull(),
  avgPrice: decimal("avg_price", { precision: 18, scale: 8 }),
  timestamp: timestamp("timestamp", { withTimezone: true }).notNull(),
});

/**
 * Alerts table - detected anomalies (immutable log)
 */
export const alerts = pgTable("alerts", {
  id: uuid("id").primaryKey().defaultRandom(),
  marketId: text("market_id")
    .notNull()
    .references(() => markets.id),
  tradeId: text("trade_id")
    .notNull()
    .references(() => trades.id),
  wallet: text("wallet").notNull(),
  score: decimal("score", { precision: 5, scale: 4 }).notNull(),
  reasons: jsonb("reasons").notNull(),
  features: jsonb("features").notNull(),
  marketState: jsonb("market_state").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Type exports for use in application code
export type Market = typeof markets.$inferSelect;
export type NewMarket = typeof markets.$inferInsert;
export type Token = typeof tokens.$inferSelect;
export type NewToken = typeof tokens.$inferInsert;
export type Trade = typeof trades.$inferSelect;
export type NewTrade = typeof trades.$inferInsert;
export type OrderbookSnapshot = typeof orderbookSnapshots.$inferSelect;
export type NewOrderbookSnapshot = typeof orderbookSnapshots.$inferInsert;
export type WalletPosition = typeof walletPositions.$inferSelect;
export type NewWalletPosition = typeof walletPositions.$inferInsert;
export type Alert = typeof alerts.$inferSelect;
export type NewAlert = typeof alerts.$inferInsert;
