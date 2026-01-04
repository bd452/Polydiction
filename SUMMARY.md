# Polymarket Anomalous Trade Detection — Architecture Summary

This document is the authoritative reference for architecture, data model, and stage boundaries. Update this document before implementing any structural changes.

---

## Project Overview

**Goal**: Detect anomalous trades and positions on Polymarket that may indicate informed trading ("smart money" or potential insider activity), log alerts, and evolve toward automated trade execution.

**Deployment Platform**: Vercel (serverless functions for API, cron jobs for polling)

---

## Stage Boundaries

### v0 — Scanner & Logging (Current)

**In Scope**:

- Polling-based market, trade, and orderbook ingestion
- Feature extraction and anomaly scoring
- Alert persistence to database
- Scheduled cron jobs for periodic scans

**Explicitly Out of Scope**:

- ❌ Live notifications (email, SMS, push) — deferred to v2
- ❌ Automated trade execution — deferred to v3
- ❌ Persistent WebSocket connections — deferred to v2 (external worker)
- ❌ User-facing UI — deferred to v1
- ❌ User accounts or authentication — deferred to v1/v2

### v1 — Read-Only App & Querying

**In Scope**:

- Frontend routes and UI pages
- API endpoints for querying alerts, markets, wallets
- Basic data visualization (static)

**Explicitly Out of Scope**:

- ❌ Live notifications
- ❌ Automated trade execution
- ❌ Real-time data (still polling-based)

### v2 — Live Detection & Notifications

**In Scope**:

- WebSocket-based live ingestion (external worker, not Vercel serverless)
- Near-real-time scoring and alert emission
- Notification system (email, SMS, push)
- User preferences for notifications

**Explicitly Out of Scope**:

- ❌ Automated trade execution

### v3 — Automated Trade Execution

**In Scope**:

- Risk and policy framework
- Isolated execution service
- Strategy engine for trade decisions
- Order construction, tracking, and reconciliation

---

## Supported Market Types

The system supports anomaly detection across all Polymarket market categories:

| Category                 | Examples                             | Priority |
| ------------------------ | ------------------------------------ | -------- |
| **Elections / Politics** | US Presidential, Congressional races | High     |
| **Sports**               | NFL, NBA, Soccer outcomes            | Medium   |
| **Crypto / Finance**     | BTC price targets, ETF approvals     | High     |
| **Entertainment**        | Awards, TV show outcomes             | Low      |
| **Science / Weather**    | Climate events, discoveries          | Low      |
| **Current Events**       | Geopolitical events, legal outcomes  | Medium   |

**Note**: All active markets are ingested. Scoring may be tuned per category in future iterations.

---

## Repository Structure (Monorepo)

This project uses a **pnpm workspaces + Turborepo** monorepo structure to support multiple services that share common code.

```
/
├── apps/
│   ├── web/              # Next.js app (v0/v1/v2 UI + API routes + cron)
│   ├── worker/           # WebSocket ingestion worker (v2, off-Vercel)
│   └── executor/         # Trade execution service (v3, isolated)
├── packages/
│   ├── db/               # Database schema, migrations, typed queries
│   ├── scoring/          # Feature extraction & anomaly scoring
│   └── types/            # Shared TypeScript types
├── turbo.json            # Turborepo configuration
├── pnpm-workspace.yaml   # Workspace definition
└── package.json          # Root package with shared dev dependencies
```

### Package Purposes

| Package                | Purpose                             | Used By               | Version |
| ---------------------- | ----------------------------------- | --------------------- | ------- |
| `@polydiction/db`      | Schema, migrations, query helpers   | web, worker, executor | v0+     |
| `@polydiction/scoring` | Feature computation, scoring logic  | web, worker           | v0+     |
| `@polydiction/types`   | Shared types (Market, Trade, Alert) | all                   | v0+     |
| `apps/web`             | Next.js API + UI                    | —                     | v0+     |
| `apps/worker`          | WebSocket ingestion                 | —                     | v2+     |
| `apps/executor`        | Trade execution                     | —                     | v3+     |

### Build & Dev Commands

```bash
pnpm dev          # Run all apps in dev mode
pnpm build        # Build all packages and apps
pnpm lint         # Lint all packages
pnpm typecheck    # Type-check all packages
pnpm test         # Run all tests
```

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Vercel Platform                         │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                      apps/web                               ││
│  ├─────────────┬─────────────┬─────────────────────────────────┤│
│  │ Cron Jobs   │ API Routes  │ Frontend (v1+)                  ││
│  │ - markets   │ - /alerts   │ - alerts feed                   ││
│  │ - trades    │ - /markets  │ - market detail                 ││
│  │ - scoring   │ - /wallets  │ - wallet detail                 ││
│  └──────┬──────┴──────┬──────┴─────────────────────────────────┘│
│         │             │                                         │
│         ▼             ▼                                         │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │              @polydiction/scoring                           ││
│  │  - FeatureExtractor   - AnomalyScorer   - AlertGenerator    ││
│  └──────────────────────────┬──────────────────────────────────┘│
│                             │                                    │
│                             ▼                                    │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │              @polydiction/db                                ││
│  │  - Typed query helpers   - Collection refs  - Validation    ││
│  └──────────────────────────┬──────────────────────────────────┘│
└─────────────────────────────┼───────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │    Firebase     │
                    │   Firestore     │
                    └─────────────────┘
                              ▲
                              │
              ┌───────────────┴───────────────┐
              │      Polymarket APIs          │
              │  - CLOB API (trades/orders)   │
              │  - Gamma API (markets)        │
              └───────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                    External Workers (v2+)                       │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────┐  ┌───────────────────────────────┐ │
│  │      apps/worker        │  │      apps/executor (v3)       │ │
│  │  - WebSocket client     │  │  - Order construction         │ │
│  │  - Event normalization  │  │  - Risk management            │ │
│  │  - Queue bridge         │  │  - Position tracking          │ │
│  └───────────┬─────────────┘  └───────────────┬───────────────┘ │
│              │                                │                  │
│              ▼                                ▼                  │
│        @polydiction/scoring            @polydiction/db          │
│        @polydiction/db                 @polydiction/types       │
└─────────────────────────────────────────────────────────────────┘
```

---

## Data Model (v0)

### Firestore Collections

The data model uses Firebase Firestore collections. Decimal values are stored as strings to preserve precision. Timestamps use Firestore's native `Timestamp` type.

#### `markets` Collection

| Field       | Type      | Description             |
| ----------- | --------- | ----------------------- |
| id          | string    | Document ID (condition_id) |
| slug        | string    | URL-friendly identifier |
| question    | string    | Market question         |
| description | string    | Full description        |
| category    | string    | Market category         |
| endDate     | Timestamp | Market resolution date  |
| active      | boolean   | Whether market is open  |
| raw         | map       | Full API response       |
| createdAt   | Timestamp | Record creation         |
| updatedAt   | Timestamp | Last update             |

#### `tokens` Collection

| Field     | Type      | Description               |
| --------- | --------- | ------------------------- |
| id        | string    | Document ID (token_id)    |
| marketId  | string    | Parent market ID          |
| outcome   | string    | Outcome name (Yes/No/etc) |
| price     | string    | Current price (decimal)   |
| raw       | map       | Full API response         |
| updatedAt | Timestamp | Last update               |

#### `trades` Collection

| Field     | Type      | Description       |
| --------- | --------- | ----------------- |
| id        | string    | Document ID (trade_id) |
| marketId  | string    | Market ID         |
| tokenId   | string    | Token ID          |
| maker     | string    | Maker address     |
| taker     | string    | Taker address     |
| side      | string    | BUY/SELL          |
| size      | string    | Trade size (decimal) |
| price     | string    | Trade price (decimal) |
| timestamp | Timestamp | Trade time        |
| raw       | map       | Full API response |
| createdAt | Timestamp | Record creation   |

#### `orderbookSnapshots` Collection

| Field     | Type      | Description         |
| --------- | --------- | ------------------- |
| id        | string    | Auto-generated ID   |
| marketId  | string    | Market ID           |
| tokenId   | string    | Token ID            |
| bestBid   | string    | Top bid price (decimal) |
| bestAsk   | string    | Top ask price (decimal) |
| bidDepth  | string    | Total bid liquidity (decimal) |
| askDepth  | string    | Total ask liquidity (decimal) |
| spread    | string    | Bid-ask spread (decimal) |
| timestamp | Timestamp | Snapshot time       |
| raw       | map       | Optional depth data |

#### `walletPositions` Collection

| Field     | Type      | Description              |
| --------- | --------- | ------------------------ |
| id        | string    | Auto-generated ID        |
| wallet    | string    | Wallet address           |
| marketId  | string    | Market ID                |
| tokenId   | string    | Token ID                 |
| position  | string    | Position size (decimal)  |
| avgPrice  | string    | Average entry (decimal, optional) |
| timestamp | Timestamp | Snapshot time            |

#### `alerts` Collection

| Field       | Type      | Description                  |
| ----------- | --------- | ---------------------------- |
| id          | string    | Auto-generated UUID          |
| marketId    | string    | Market ID                    |
| tradeId     | string    | Triggering trade ID          |
| wallet      | string    | Wallet flagged               |
| score       | string    | Anomaly score (decimal)      |
| reasons     | map       | Contributing factors         |
| features    | map       | Computed features            |
| marketState | map       | Market context at alert time |
| createdAt   | Timestamp | Alert creation (immutable)   |

### Firestore Indexes

Required composite indexes for efficient querying:

```json
{
  "indexes": [
    {
      "collectionGroup": "trades",
      "fields": [
        { "fieldPath": "marketId", "order": "ASCENDING" },
        { "fieldPath": "timestamp", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "alerts",
      "fields": [
        { "fieldPath": "marketId", "order": "ASCENDING" },
        { "fieldPath": "score", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "alerts",
      "fields": [
        { "fieldPath": "wallet", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "orderbookSnapshots",
      "fields": [
        { "fieldPath": "tokenId", "order": "ASCENDING" },
        { "fieldPath": "timestamp", "order": "DESCENDING" }
      ]
    }
  ]
}
```

### Firestore vs PostgreSQL Considerations

| Aspect | PostgreSQL | Firestore (Current) |
|--------|------------|---------------------|
| **Joins** | Native SQL joins | No joins - use multiple queries or denormalize |
| **Transactions** | Full ACID | Single document or batch (max 500 ops) |
| **Aggregations** | SQL aggregates | Client-side or Cloud Functions |
| **Decimal precision** | Native DECIMAL | Store as strings, parse in application |
| **Time-series queries** | Standard SQL | Requires composite indexes |
| **Schema enforcement** | DDL constraints | Application-level validation (Zod) |

---

## Anomaly Detection Overview

### Detection Goal

**Insider Detection (Exclusively)** — The system aims to detect trades that suggest the trader has access to non-public information. This is distinct from "smart money" detection (following skilled traders regardless of information source).

Key characteristics of insider-indicative trades:

- Unusually large positions taken shortly before material news
- New or dormant wallets suddenly making significant trades
- Aggressive execution (paying spread, lifting offers) suggesting urgency
- Timing correlation with subsequent price-moving events

**Note**: Detection is NOT restricted to markets with defined end dates. Events can resolve unexpectedly (e.g., geopolitical events, sudden announcements).

### False Positive Tolerance

**High Recall Approach** — Initial false positives are acceptable. The priority is to avoid missing true insider signals.

The system uses an **adjustable sensitivity value**:

- v0: Defined as a constant (`ALERT_SENSITIVITY`) in configuration
- v1+: UI-adjustable per user or globally

```typescript
// Sensitivity range: 0.0 (most permissive) to 1.0 (most strict)
// Lower values = more alerts (higher recall, more false positives)
// Higher values = fewer alerts (higher precision, may miss signals)
const ALERT_SENSITIVITY = 0.3; // Start permissive
```

### Feature Set (v0)

1. **Trade Size vs Market Median** — How large is this trade relative to typical trades?
2. **Trade Size vs Available Depth** — Is the trade large relative to orderbook liquidity?
3. **Aggressiveness** — Taker vs maker, spread crossing behavior
4. **Wallet Burst Behavior** — Rapid successive trades from same wallet
5. **Position Concentration** — How concentrated is the wallet's position?
6. **Ramp Speed** — How quickly is the wallet building a position?
7. **Timing vs Market End** — Trades close to resolution may be more informative
8. **Wallet Age/Activity** — New or dormant wallets are more suspicious
9. **Dollar Value** — Absolute size matters (a $50k trade is noteworthy regardless of %)

### Scoring Model (v0)

Initial approach: Weighted linear combination of normalized features.

```
score = Σ (weight_i × normalized_feature_i)
```

Each feature is normalized to [0, 1] range. Weights reflect insider-detection priority:

| Feature                | Weight | Rationale                                |
| ---------------------- | ------ | ---------------------------------------- |
| Trade size vs median   | 0.15   | Large relative trades are notable        |
| Trade size vs depth    | 0.15   | Consuming liquidity suggests urgency     |
| Aggressiveness         | 0.20   | Paying spread indicates time-sensitivity |
| Wallet burst           | 0.15   | Rapid accumulation suggests conviction   |
| Position concentration | 0.10   | All-in bets are suspicious               |
| Ramp speed             | 0.10   | Fast position building                   |
| Wallet freshness       | 0.10   | New wallets making big trades            |
| Dollar value           | 0.05   | Absolute size as tiebreaker              |

### Alert Thresholds ("Interesting" Definition)

An alert is generated when the weighted score exceeds a dynamic threshold based on sensitivity:

```typescript
// Base threshold adjusted by sensitivity
const alertThreshold = 0.25 + ALERT_SENSITIVITY * 0.5;
// At sensitivity 0.3: threshold = 0.25 + 0.15 = 0.40
// At sensitivity 0.0: threshold = 0.25 (very permissive)
// At sensitivity 1.0: threshold = 0.75 (very strict)
```

**Automatic "Must-Flag" Conditions** (bypass scoring, always alert):

- Single trade > $25,000 USD equivalent
- Wallet accumulates > $50,000 position in < 1 hour
- New wallet (< 7 days old) makes trade > $10,000
- Position exceeds 5% of market's total liquidity

Alerts are persisted when `score >= alertThreshold` OR any must-flag condition is met.

---

## External Dependencies

| Service              | Purpose                   | Required Env Var                                                  |
| -------------------- | ------------------------- | ----------------------------------------------------------------- |
| Polymarket CLOB API  | Trades, orders, orderbook | `POLYMARKET_API_URL`                                              |
| Polymarket Gamma API | Markets, events, tokens   | `GAMMA_API_URL`                                                   |
| Firebase / Firestore | Data persistence          | `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` |

---

## Environment Variables

See `.env.example` for required configuration:

```
# Firebase Configuration
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project-id.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# Polymarket APIs
POLYMARKET_API_URL=https://clob.polymarket.com
GAMMA_API_URL=https://gamma-api.polymarket.com
```

### Firebase Setup

1. Create a Firebase project at [Firebase Console](https://console.firebase.google.com/)
2. Enable Firestore Database in the project
3. Generate a service account key:
   - Go to Project Settings → Service Accounts
   - Click "Generate new private key"
   - Download the JSON file
4. Extract credentials from the JSON file:
   - `FIREBASE_PROJECT_ID` → `project_id` field
   - `FIREBASE_CLIENT_EMAIL` → `client_email` field
   - `FIREBASE_PRIVATE_KEY` → `private_key` field (preserve newlines)

---

## Decision Log

Major architectural decisions should be recorded in `docs/decisions/`.

| Date       | Decision                       | Rationale                                                                                                      |
| ---------- | ------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| 2026-01-04 | Monorepo with pnpm + Turborepo | v2 requires external worker, v3 requires isolated executor; shared db/scoring/types packages avoid duplication |
| 2026-01-04 | Firebase/Firestore for storage | Serverless-native, real-time capabilities for v2, integrated auth for future, no connection pooling concerns on Vercel |
| TBD        | Use Vercel cron for v0 polling | Simplicity, no infrastructure overhead                                                                         |
| TBD        | Defer WebSocket to v2          | Vercel serverless incompatible with long-lived connections                                                     |
