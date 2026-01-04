# Polymarket Anomalous Trade Detection — Product Todo List

---

## v0 — Scanner & Logging (No UI, No Live, No Execution)

### Core Product Definition ✓

- [x] Define product scope and constraints { SUMMARY.md }
  - [x] Explicitly exclude live notifications and trading { SUMMARY.md }
  - [x] Explicitly exclude persistent websocket connections { SUMMARY.md }
  - [x] Define supported market types (elections, sports, crypto, etc.) { SUMMARY.md }
- [x] Define anomaly detection goals { SUMMARY.md }
  - [x] Decide whether goal is insider detection vs. "smart money" detection { SUMMARY.md }
  - [x] Decide whether false positives are acceptable early on { SUMMARY.md }
  - [x] Define what "interesting" means in measurable terms { SUMMARY.md }

### Repository & Environment Setup ✓

- [x] Initialize monorepo structure { package.json, pnpm-workspace.yaml, turbo.json }
  - [x] Configure TypeScript + Node target { tsconfig.json }
  - [x] Set up linting / formatting { eslint.config.mjs, .prettierrc }
  - [x] Set up pnpm workspaces { pnpm-workspace.yaml }
  - [x] Set up Turborepo { turbo.json }
  - [x] Create shared packages structure { packages/db, packages/scoring, packages/types }
- [x] Initialize Next.js app (API-first) { apps/web }
  - [x] Enable App Router { apps/web/src/app }
  - [x] Disable unnecessary frontend scaffolding
- [x] Configure environment variable handling
  - [x] Add `.env.example` { .env.example }
  - [x] Define API base URLs and keys (Polymarket, DB) { apps/web/src/env.ts }
- [x] Configure GitHub CI/CD { .github/workflows/ }
  - [x] Create main CI workflow for builds, tests, and lints { .github/workflows/ci.yml }
  - [x] Configure pnpm caching for faster builds
  - [x] Add Turbo remote caching (optional)
  - [x] Set up status checks and branch protection rules { docs/ops/branch-protection.md }

### Data Model & Storage

- [x] Choose database (e.g., Postgres-compatible) < SUMMARY.md >
- [x] Design initial schema { packages/db/src/schema.ts }
  - [x] Markets table
  - [x] Tokens / outcomes table
  - [x] Trades table
  - [x] Orderbook snapshot table
  - [x] User activity / positions table
  - [x] Alerts table
- [x] Implement migrations { packages/db/drizzle/ }
- [ ] Implement DB access layer { packages/db/src/ }
  - [ ] Typed query helpers { packages/db/src/queries/ }
  - [x] JSONB support for raw payloads

### Firebase Migration

Migrate from PostgreSQL/Drizzle to Firebase/Firestore for data storage.

#### Package Dependencies { packages/db/package.json }

- [ ] Remove `drizzle-orm` dependency
- [ ] Remove `@neondatabase/serverless` dependency
- [ ] Remove `drizzle-kit` dev dependency
- [ ] Add `firebase-admin` dependency

#### Database Client { packages/db/src/client.ts }

- [ ] Remove Neon/Drizzle client initialization
- [ ] Implement Firebase Admin SDK initialization
- [ ] Export Firestore database instance
- [ ] Handle Firebase service account credentials

#### Schema Conversion { packages/db/src/schema.ts }

- [ ] Remove Drizzle schema definitions (`pgTable`, `decimal`, `jsonb`, etc.)
- [ ] Define TypeScript interfaces for Firestore documents
  - [ ] `Market` document interface
  - [ ] `Token` document interface
  - [ ] `Trade` document interface
  - [ ] `OrderbookSnapshot` document interface
  - [ ] `WalletPosition` document interface
  - [ ] `Alert` document interface
- [ ] Add Zod schemas for runtime validation (optional)
- [ ] Handle decimal precision (store as strings or scaled integers)
- [ ] Handle timestamp conversions (Firestore Timestamp type)

#### Firestore Collections { packages/db/src/collections.ts }

- [ ] Create new collections module
- [ ] Define collection references
  - [ ] `markets` collection
  - [ ] `tokens` collection (or subcollection under markets)
  - [ ] `trades` collection
  - [ ] `orderbookSnapshots` collection
  - [ ] `walletPositions` collection
  - [ ] `alerts` collection
- [ ] Define composite indexes for common queries { firestore.indexes.json }
  - [ ] Trades by market + timestamp
  - [ ] Alerts by market + score
  - [ ] Alerts by wallet + timestamp
  - [ ] Orderbook snapshots by token + timestamp

#### Remove Drizzle Artifacts

- [ ] Delete `packages/db/drizzle/` folder (migrations no longer needed)
- [ ] Delete `packages/db/drizzle.config.ts`
- [ ] Remove Drizzle-related scripts from `packages/db/package.json`

#### Environment Configuration

- [ ] Update `.env.example` with Firebase variables
  - [ ] Remove `DATABASE_URL`
  - [ ] Add `FIREBASE_PROJECT_ID`
  - [ ] Add `FIREBASE_CLIENT_EMAIL`
  - [ ] Add `FIREBASE_PRIVATE_KEY`
- [ ] Update `apps/web/src/env.ts` with Firebase env validation
- [ ] Document service account setup in README or docs

#### Query Helpers { packages/db/src/queries/ }

- [ ] Implement Firestore query helpers
  - [ ] `markets.ts` - market CRUD operations
  - [ ] `tokens.ts` - token CRUD operations
  - [ ] `trades.ts` - trade ingestion with deduplication
  - [ ] `orderbook.ts` - orderbook snapshot storage
  - [ ] `positions.ts` - wallet position snapshots
  - [ ] `alerts.ts` - alert persistence
  - [ ] `baselines.ts` - rolling baseline cache
- [ ] Handle Firestore query limitations
  - [ ] No joins - implement denormalization strategy
  - [ ] Limited compound queries - design around constraints
  - [ ] Client-side aggregations where needed

#### Architecture Documentation { SUMMARY.md }

- [ ] Update External Dependencies table (PostgreSQL → Firebase)
- [ ] Update High-Level Architecture diagram
- [ ] Update Data Model section for Firestore collections
- [ ] Add Decision Log entry for Firebase migration

#### Testing & CI/CD

- [ ] Remove PostgreSQL-related CI setup { .github/workflows/ci.yml }
- [ ] Add Firebase emulator configuration (optional)
- [ ] Add Firebase credentials as GitHub secrets
- [ ] Validate Firestore security rules (if applicable)

### Market Universe Ingestion

- [ ] Implement market discovery service { apps/web/src/services/markets.ts }
  - [ ] Fetch active markets from Polymarket metadata API
  - [ ] Normalize markets, events, and tokens { packages/types/src/market.ts }
  - [ ] Store/update market records idempotently { packages/db/src/queries/markets.ts }
- [ ] Schedule periodic market refresh { apps/web/src/app/api/cron/markets/route.ts }
  - [ ] Set up Vercel cron job { apps/web/vercel.json }
  - [ ] Ensure safe re-runs

### Trade & State Ingestion (Polling-Based)

- [ ] Implement trade polling service { apps/web/src/services/trades.ts }
  - [ ] Fetch recent trades per market
  - [ ] Handle pagination / cursors
  - [ ] Deduplicate trades { packages/db/src/queries/trades.ts }
- [ ] Implement orderbook snapshot polling { apps/web/src/services/orderbook.ts }
  - [ ] Fetch top-of-book + depth metrics
  - [ ] Store lightweight snapshots only { packages/db/src/queries/orderbook.ts }
- [ ] Implement user position polling (where available) { apps/web/src/services/positions.ts }
  - [ ] Fetch top holders or position deltas
  - [ ] Store time-series snapshots { packages/db/src/queries/positions.ts }

### Feature Computation Layer

- [ ] Define feature set { packages/scoring/src/features/ } < SUMMARY.md >
  - [ ] Trade size vs market median { packages/scoring/src/features/trade-size.ts }
  - [ ] Trade size vs available depth { packages/scoring/src/features/depth-ratio.ts }
  - [ ] Aggressiveness (taker/maker, spread crossing) { packages/scoring/src/features/aggressiveness.ts }
  - [ ] Wallet burst behavior { packages/scoring/src/features/wallet-burst.ts }
  - [ ] Position concentration and ramp speed { packages/scoring/src/features/position.ts }
  - [ ] Timing vs market end { packages/scoring/src/features/timing.ts }
- [ ] Implement feature computation { packages/scoring/src/extract.ts }
  - [ ] Normalize per-market { packages/scoring/src/normalize.ts }
  - [ ] Cache rolling baselines { packages/db/src/queries/baselines.ts }
- [ ] Validate feature stability on re-runs

### Anomaly Scoring

- [ ] Define scoring model (weighted linear or heuristic) { packages/scoring/src/scorer.ts } < SUMMARY.md >
- [ ] Implement score computation { packages/scoring/src/scorer.ts }
  - [ ] Compute total score
  - [ ] Extract top contributing factors
- [ ] Define "interesting" threshold { packages/scoring/src/config.ts } < SUMMARY.md >
- [ ] Persist alerts { packages/db/src/queries/alerts.ts }
  - [ ] Include score, reasons, references
  - [ ] Mark alerts as immutable logs

### Scheduling & Reliability

- [ ] Configure cron cadence { apps/web/vercel.json }
- [ ] Add rate limit handling { apps/web/src/lib/rate-limit.ts }
- [ ] Add retry / backoff logic { apps/web/src/lib/retry.ts }
- [ ] Add basic logging and metrics { apps/web/src/lib/logger.ts }

---

## v1 — Read-Only App & Querying

### Application Shell

- [ ] Enable frontend routes { apps/web/src/app/(ui)/ }
- [ ] Set up basic layout (no auth) { apps/web/src/app/(ui)/layout.tsx }
- [ ] Define navigation structure { apps/web/src/components/nav.tsx }

### API Layer

- [ ] Implement alerts API { apps/web/src/app/api/alerts/route.ts }
  - [ ] Filter by score
  - [ ] Filter by market
  - [ ] Filter by wallet
  - [ ] Time-based pagination
- [ ] Implement markets API { apps/web/src/app/api/markets/route.ts }
- [ ] Implement wallet activity API { apps/web/src/app/api/wallets/route.ts }
- [ ] Implement single-alert detail API { apps/web/src/app/api/alerts/[id]/route.ts }

### UI Pages

- [ ] Alerts feed page { apps/web/src/app/(ui)/alerts/page.tsx }
  - [ ] Sort by score / time
  - [ ] Highlight reason summary
- [ ] Market detail page { apps/web/src/app/(ui)/markets/[id]/page.tsx }
  - [ ] Market metadata
  - [ ] Alerts within market
  - [ ] Trade context
- [ ] Wallet detail page { apps/web/src/app/(ui)/wallets/[address]/page.tsx }
  - [ ] Position history
  - [ ] Alerts involving wallet
- [ ] Alert detail view { apps/web/src/app/(ui)/alerts/[id]/page.tsx }
  - [ ] Raw trade data
  - [ ] Feature breakdown
  - [ ] Market state at time of trade

### Data Presentation

- [ ] Implement formatting helpers { apps/web/src/lib/format.ts }
  - [ ] Price / probability formatting
  - [ ] Size normalization
- [ ] Implement lightweight charts (static snapshots only) { apps/web/src/components/charts/ }
- [ ] Add linking between markets, wallets, alerts

### Hardening

- [ ] Add request validation { apps/web/src/lib/validation.ts }
- [ ] Add API rate limits { apps/web/src/middleware.ts }
- [ ] Add basic caching for heavy queries
- [ ] Add health check endpoint { apps/web/src/app/api/health/route.ts }

---

## v2 — Live Detection & Notifications

### Live Data Ingestion

- [ ] Decide streaming strategy (external worker vs enhanced polling) < SUMMARY.md >
- [ ] Implement websocket ingestion service (off-Vercel) { apps/worker/src/ }
  - [ ] Subscribe to market-level feeds { apps/worker/src/ws-client.ts }
  - [ ] Parse and normalize events { apps/worker/src/normalize.ts }
- [ ] Implement ingestion endpoint / queue bridge { apps/web/src/app/api/ingest/route.ts }
- [ ] Ensure idempotent ingestion { packages/db/src/queries/trades.ts }

### Near-Real-Time Scoring

- [ ] Adapt feature computation for streaming data { packages/scoring/src/streaming.ts }
- [ ] Ensure rolling baselines update safely { packages/db/src/queries/baselines.ts }
- [ ] Trigger scoring on new events { apps/worker/src/pipeline.ts }
- [ ] Emit alerts immediately on threshold breach

### Notification System

- [ ] Define notification triggers { apps/web/src/services/notifications.ts }
- [ ] Implement notification queue
- [ ] Implement email notifications
- [ ] Implement SMS notifications
- [ ] Implement push / web notifications
- [ ] Add per-channel opt-in flags { packages/db/src/schema.ts }
- [ ] Add rate limiting and deduplication

### User Preferences

- [ ] Define user model (lightweight) { packages/db/src/schema.ts }
- [ ] Store notification preferences { packages/db/src/queries/users.ts }
- [ ] Allow per-market / per-score thresholds

### Monitoring & Safety

- [ ] Add alert volume monitoring
- [ ] Add kill switch for live detection { apps/worker/src/kill-switch.ts }
- [ ] Add ingestion failure alarms

---

## v3 — Automated Trade Execution

### Risk & Policy Framework

- [ ] Define global risk limits { apps/executor/src/risk/limits.ts }
- [ ] Define per-market exposure caps { apps/executor/src/risk/market-caps.ts }
- [ ] Define per-alert trade size limits { apps/executor/src/risk/sizing.ts }
- [ ] Define loss and drawdown limits { apps/executor/src/risk/drawdown.ts }
- [ ] Implement emergency kill switch { apps/executor/src/risk/kill-switch.ts }

### Execution Service

- [ ] Isolate execution into separate service { apps/executor/ }
- [ ] Secure API keys and signing logic { apps/executor/src/auth/ }
- [ ] Implement order construction { apps/executor/src/orders/build.ts }
- [ ] Implement slippage and timeout controls { apps/executor/src/orders/controls.ts }
- [ ] Implement order tracking and reconciliation { apps/executor/src/orders/tracking.ts }

### Strategy Engine

- [ ] Define initial tailing strategy { apps/executor/src/strategy/tail.ts }
  - [ ] Minimum score threshold
  - [ ] Confirmation requirements
- [ ] Implement probing order logic { apps/executor/src/strategy/probe.ts }
- [ ] Implement scale-in logic { apps/executor/src/strategy/scale.ts }
- [ ] Implement stop conditions { apps/executor/src/strategy/stops.ts }
- [ ] Implement post-trade evaluation { apps/executor/src/strategy/evaluate.ts }

### Integration

- [ ] Connect alerts to strategy engine { apps/executor/src/pipeline.ts }
- [ ] Connect strategy engine to execution service
- [ ] Persist trades and outcomes { packages/db/src/queries/executions.ts }
- [ ] Update positions and PnL tracking { packages/db/src/queries/pnl.ts }

### Evaluation & Iteration

- [ ] Measure slippage vs signal originator
- [ ] Measure net profitability
- [ ] Track false positives { packages/db/src/queries/alerts.ts }
- [ ] Adjust scoring weights and strategy rules { packages/scoring/src/config.ts }
