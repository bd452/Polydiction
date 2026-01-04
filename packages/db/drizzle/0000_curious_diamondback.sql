CREATE TABLE "alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"market_id" text NOT NULL,
	"trade_id" text NOT NULL,
	"wallet" text NOT NULL,
	"score" numeric(5, 4) NOT NULL,
	"reasons" jsonb NOT NULL,
	"features" jsonb NOT NULL,
	"market_state" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "markets" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"question" text NOT NULL,
	"description" text NOT NULL,
	"category" text NOT NULL,
	"end_date" timestamp with time zone,
	"active" boolean DEFAULT true NOT NULL,
	"raw" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orderbook_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"market_id" text NOT NULL,
	"token_id" text NOT NULL,
	"best_bid" numeric(18, 8) NOT NULL,
	"best_ask" numeric(18, 8) NOT NULL,
	"bid_depth" numeric(18, 8) NOT NULL,
	"ask_depth" numeric(18, 8) NOT NULL,
	"spread" numeric(18, 8) NOT NULL,
	"timestamp" timestamp with time zone NOT NULL,
	"raw" jsonb
);
--> statement-breakpoint
CREATE TABLE "tokens" (
	"id" text PRIMARY KEY NOT NULL,
	"market_id" text NOT NULL,
	"outcome" text NOT NULL,
	"price" numeric(18, 8) NOT NULL,
	"raw" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trades" (
	"id" text PRIMARY KEY NOT NULL,
	"market_id" text NOT NULL,
	"token_id" text NOT NULL,
	"maker" text NOT NULL,
	"taker" text NOT NULL,
	"side" text NOT NULL,
	"size" numeric(18, 8) NOT NULL,
	"price" numeric(18, 8) NOT NULL,
	"timestamp" timestamp with time zone NOT NULL,
	"raw" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wallet_positions" (
	"id" serial PRIMARY KEY NOT NULL,
	"wallet" text NOT NULL,
	"market_id" text NOT NULL,
	"token_id" text NOT NULL,
	"position" numeric(18, 8) NOT NULL,
	"avg_price" numeric(18, 8),
	"timestamp" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_market_id_markets_id_fk" FOREIGN KEY ("market_id") REFERENCES "public"."markets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_trade_id_trades_id_fk" FOREIGN KEY ("trade_id") REFERENCES "public"."trades"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orderbook_snapshots" ADD CONSTRAINT "orderbook_snapshots_market_id_markets_id_fk" FOREIGN KEY ("market_id") REFERENCES "public"."markets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orderbook_snapshots" ADD CONSTRAINT "orderbook_snapshots_token_id_tokens_id_fk" FOREIGN KEY ("token_id") REFERENCES "public"."tokens"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tokens" ADD CONSTRAINT "tokens_market_id_markets_id_fk" FOREIGN KEY ("market_id") REFERENCES "public"."markets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trades" ADD CONSTRAINT "trades_market_id_markets_id_fk" FOREIGN KEY ("market_id") REFERENCES "public"."markets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trades" ADD CONSTRAINT "trades_token_id_tokens_id_fk" FOREIGN KEY ("token_id") REFERENCES "public"."tokens"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_positions" ADD CONSTRAINT "wallet_positions_market_id_markets_id_fk" FOREIGN KEY ("market_id") REFERENCES "public"."markets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_positions" ADD CONSTRAINT "wallet_positions_token_id_tokens_id_fk" FOREIGN KEY ("token_id") REFERENCES "public"."tokens"("id") ON DELETE no action ON UPDATE no action;