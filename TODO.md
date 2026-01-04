# Polymarket Anomalous Trade Detection — Product Todo List

---

## v0 — Scanner & Logging (No UI, No Live, No Execution)

### Core Product Definition ✓
- [X] Define product scope and constraints { SUMMARY.md }
  - [X] Explicitly exclude live notifications and trading { SUMMARY.md }
  - [X] Explicitly exclude persistent websocket connections { SUMMARY.md }
  - [X] Define supported market types (elections, sports, crypto, etc.) { SUMMARY.md }
- [X] Define anomaly detection goals { SUMMARY.md }
  - [X] Decide whether goal is insider detection vs. "smart money" detection { SUMMARY.md }
  - [X] Decide whether false positives are acceptable early on { SUMMARY.md }
  - [X] Define what "interesting" means in measurable terms { SUMMARY.md }

### Repository & Environment Setup
- [ ] Initialize empty Git repository
  - [ ] Configure TypeScript + Node target
  - [ ] Set up linting / formatting
- [ ] Initialize Next.js app (API-first)
  - [ ] Enable App Router
  - [ ] Disable unnecessary frontend scaffolding
- [ ] Configure environment variable handling
  - [ ] Add `.env.example`
  - [ ] Define API base URLs and keys (Polymarket, DB)

### Data Model & Storage
- [ ] Choose database (e.g., Postgres-compatible)
- [ ] Design initial schema
  - [ ] Markets table
  - [ ] Tokens / outcomes table
  - [ ] Trades table
  - [ ] Orderbook snapshot table
  - [ ] User activity / positions table
  - [ ] Alerts table
- [ ] Implement migrations
- [ ] Implement DB access layer
  - [ ] Typed query helpers
  - [ ] JSONB support for raw payloads

### Market Universe Ingestion
- [ ] Implement market discovery service
  - [ ] Fetch active markets from Polymarket metadata API
  - [ ] Normalize markets, events, and tokens
  - [ ] Store/update market records idempotently
- [ ] Schedule periodic market refresh
  - [ ] Set up Vercel cron job
  - [ ] Ensure safe re-runs

### Trade & State Ingestion (Polling-Based)
- [ ] Implement trade polling service
  - [ ] Fetch recent trades per market
  - [ ] Handle pagination / cursors
  - [ ] Deduplicate trades
- [ ] Implement orderbook snapshot polling
  - [ ] Fetch top-of-book + depth metrics
  - [ ] Store lightweight snapshots only
- [ ] Implement user position polling (where available)
  - [ ] Fetch top holders or position deltas
  - [ ] Store time-series snapshots

### Feature Computation Layer
- [ ] Define feature set
  - [ ] Trade size vs market median
  - [ ] Trade size vs available depth
  - [ ] Aggressiveness (taker/maker, spread crossing)
  - [ ] Wallet burst behavior
  - [ ] Position concentration and ramp speed
  - [ ] Timing vs market end
- [ ] Implement feature computation
  - [ ] Normalize per-market
  - [ ] Cache rolling baselines
- [ ] Validate feature stability on re-runs

### Anomaly Scoring
- [ ] Define scoring model (weighted linear or heuristic)
- [ ] Implement score computation
  - [ ] Compute total score
  - [ ] Extract top contributing factors
- [ ] Define "interesting" threshold
- [ ] Persist alerts
  - [ ] Include score, reasons, references
  - [ ] Mark alerts as immutable logs

### Scheduling & Reliability
- [ ] Configure cron cadence
- [ ] Add rate limit handling
- [ ] Add retry / backoff logic
- [ ] Add basic logging and metrics

---

## v1 — Read-Only App & Querying

### Application Shell
- [ ] Enable frontend routes
- [ ] Set up basic layout (no auth)
- [ ] Define navigation structure

### API Layer
- [ ] Implement alerts API
  - [ ] Filter by score
  - [ ] Filter by market
  - [ ] Filter by wallet
  - [ ] Time-based pagination
- [ ] Implement markets API
- [ ] Implement wallet activity API
- [ ] Implement single-alert detail API

### UI Pages
- [ ] Alerts feed page
  - [ ] Sort by score / time
  - [ ] Highlight reason summary
- [ ] Market detail page
  - [ ] Market metadata
  - [ ] Alerts within market
  - [ ] Trade context
- [ ] Wallet detail page
  - [ ] Position history
  - [ ] Alerts involving wallet
- [ ] Alert detail view
  - [ ] Raw trade data
  - [ ] Feature breakdown
  - [ ] Market state at time of trade

### Data Presentation
- [ ] Implement formatting helpers
  - [ ] Price / probability formatting
  - [ ] Size normalization
- [ ] Implement lightweight charts (static snapshots only)
- [ ] Add linking between markets, wallets, alerts

### Hardening
- [ ] Add request validation
- [ ] Add API rate limits
- [ ] Add basic caching for heavy queries
- [ ] Add health check endpoint

---

## v2 — Live Detection & Notifications

### Live Data Ingestion
- [ ] Decide streaming strategy (external worker vs enhanced polling)
- [ ] Implement websocket ingestion service (off-Vercel)
  - [ ] Subscribe to market-level feeds
  - [ ] Parse and normalize events
- [ ] Implement ingestion endpoint / queue bridge
- [ ] Ensure idempotent ingestion

### Near-Real-Time Scoring
- [ ] Adapt feature computation for streaming data
- [ ] Ensure rolling baselines update safely
- [ ] Trigger scoring on new events
- [ ] Emit alerts immediately on threshold breach

### Notification System
- [ ] Define notification triggers
- [ ] Implement notification queue
- [ ] Implement email notifications
- [ ] Implement SMS notifications
- [ ] Implement push / web notifications
- [ ] Add per-channel opt-in flags
- [ ] Add rate limiting and deduplication

### User Preferences
- [ ] Define user model (lightweight)
- [ ] Store notification preferences
- [ ] Allow per-market / per-score thresholds

### Monitoring & Safety
- [ ] Add alert volume monitoring
- [ ] Add kill switch for live detection
- [ ] Add ingestion failure alarms

---

## v3 — Automated Trade Execution

### Risk & Policy Framework
- [ ] Define global risk limits
- [ ] Define per-market exposure caps
- [ ] Define per-alert trade size limits
- [ ] Define loss and drawdown limits
- [ ] Implement emergency kill switch

### Execution Service
- [ ] Isolate execution into separate service
- [ ] Secure API keys and signing logic
- [ ] Implement order construction
- [ ] Implement slippage and timeout controls
- [ ] Implement order tracking and reconciliation

### Strategy Engine
- [ ] Define initial tailing strategy
  - [ ] Minimum score threshold
  - [ ] Confirmation requirements
- [ ] Implement probing order logic
- [ ] Implement scale-in logic
- [ ] Implement stop conditions
- [ ] Implement post-trade evaluation

### Integration
- [ ] Connect alerts to strategy engine
- [ ] Connect strategy engine to execution service
- [ ] Persist trades and outcomes
- [ ] Update positions and PnL tracking

### Evaluation & Iteration
- [ ] Measure slippage vs signal originator
- [ ] Measure net profitability
- [ ] Track false positives
- [ ] Adjust scoring weights and strategy rules
