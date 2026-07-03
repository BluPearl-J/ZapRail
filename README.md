# ZapRailbackend
# ZapRail — Nomba × Zapier Integration

> Bridging Nomba payments to 5,000+ apps via Zapier — instant, secure, automated.
# What it does

ZapRail connects Nomba payment events to Zapier in real time — so Nigerian SMEs get instant Slack alerts, auto-updated spreadsheets, and one-click refunds without writing code.

## Why it's different

- ⚡ **REST Hooks** — triggers fire in seconds, not 5-minute polling cycles
- 🔐 **HMAC-SHA256 webhook verification** — real Nomba signing spec, timing-safe
- 🔁 **Idempotent refunds** — double-click or retry can never charge a customer twice
- 🚨 **`payment_failed` trigger** — competitors don't expose this

## Progress

- [x] Webhook receiver + HMAC-SHA256 signature verification
- [x] requestId idempotency — safe across Nomba's 5-retry sequence
- [x] REST Hook dispatcher — instant Zap delivery
- [x] Idempotent refund endpoint
- [x] Dashboard UI (mock data — backend wiring in progress)
- [ ] Zapier CLI app — in progress

