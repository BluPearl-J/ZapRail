# Nomba Zap Connect

A production-grade backend powering a Zapier integration for Nomba payments.
Built for the Nomba x DevCareer Hackathon — Integrations & Plugins track.

## What this does

- Receives Nomba webhooks, **verifies their signature**, and processes each
  event exactly once (idempotency), even if Nomba retries delivery.
- Pushes events to subscribed Zaps **instantly** via REST Hooks (not slow
  polling, which is what most existing payment-Zapier integrations rely on).
- Exposes triggers most competing integrations don't have:
  `new_transaction`, `payment_failed`, `refund_completed`, `webhook_received`.
- Exposes a `refund` action that's idempotent — a duplicate click or Zap
  retry can never double-refund a customer.
- Provides REST endpoints for the Lovable-built admin dashboard.

## Architecture

```
Nomba ──webhook──> /webhooks/nomba ──verify signature──> store event (idempotent)
                                          │
                                          ├─> update transactions/refunds table
                                          └─> dispatchToZapier() ──POST──> each
                                              subscribed Zap's target URL
                                              (REST Hooks pattern)

Zapier CLI app ──subscribe/unsubscribe──> /zapier/subscribe, /zapier/unsubscribe/:id
Zapier CLI app ──polling fallback───────> /zapier/poll/:triggerType
Zapier CLI app ──refund action──────────> /refunds (POST)
Lovable dashboard ──reads/writes────────> /transactions, /refunds
```

## Setup

```bash
npm install
cp .env.example .env
# fill in your real Nomba credentials and webhook secret in .env
npm start
```

Server runs on `http://localhost:4000` by default.

## Testing the webhook flow locally

```bash
node scripts/send-test-webhook.js
```

This signs a sample payload with your `NOMBA_WEBHOOK_SECRET` and posts it
to `/webhooks/nomba`, exactly as Nomba would.

## Security notes (for the hackathon judging rubric)

- **Webhook signature verification**: every inbound webhook is verified
  using HMAC-SHA256 with a timing-safe comparison (`crypto.timingSafeEqual`)
  before any data is trusted. Invalid-signature events are logged but
  never acted on.
- **Idempotency**: webhook events are deduped by `eventId` at the database
  level (`UNIQUE` constraint), and refunds are blocked if one is already
  pending/processed for the same transaction — this prevents duplicate
  processing from webhook retries or double-clicks.
- **Auth on internal routes**: `/transactions`, `/refunds`, and `/zapier/*`
  require an `x-api-key` header matching `INTERNAL_API_KEYS`, so only your
  Zapier app and your dashboard can call them.
- **No secrets in responses**: error handler returns generic messages, no
  stack traces, to API consumers.
- **Dead-hook handling**: failed deliveries to a Zap's target URL are
  logged and isolated — one broken Zap subscription can't break delivery
  to everyone else.

## API reference

| Method | Path | Purpose |
|---|---|---|
| POST | `/webhooks/nomba` | Inbound Nomba webhook receiver |
| GET | `/transactions` | List transactions (filter by `?status=`) |
| GET | `/transactions/:reference` | Look up one transaction |
| POST | `/refunds` | Issue a refund |
| GET | `/refunds` | List refunds |
| POST | `/zapier/subscribe` | Zapier REST Hook subscribe |
| DELETE | `/zapier/unsubscribe/:id` | Zapier REST Hook unsubscribe |
| GET | `/zapier/poll/:triggerType` | Polling fallback for Zap editor sample data |
| GET | `/health` | Health check |

## Notes before deploying

- Confirm the exact webhook signature header name and signing scheme in
  Nomba's API docs — `lib/verifySignature.js` is built around the common
  HMAC-SHA256-over-raw-body pattern and is isolated so it's a one-file
  change if Nomba's scheme differs.
- Confirm the auth/refund endpoint paths in `lib/nombaClient.js` against
  Nomba's current API reference before connecting real credentials.
- Swap the SQLite file (`data/nomba_zap.db`) for a managed Postgres
  instance before production traffic — SQLite is fine for a hackathon demo
  and judge review but won't handle concurrent writes at scale.
