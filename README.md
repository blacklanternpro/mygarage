# MyGarage: Companion CX & Vehicle Health layer for independent Australian workshops

A zero-double-entry customer garage that sits beside the workshop's existing system (MechanicDesk,
Workshop Software, COSTAR). Invoices and "ones to watch" become a shop-branded, multi-vehicle garage
on the customer's phone, plus an Apple/Google Wallet "digital service sticker", a front-counter
publish-and-recover console and a voice-first bay inspection tool.

**Stage 1** (this repo today): production-shaped multi-tenant foundation + interactive prototype,
with every external provider behind a typed mock adapter.

```bash
npm install
npm run db:seed   # optional, the app auto-seeds an empty DB
npm run dev       # http://localhost:3000
```

| Surface | URL |
|---|---|
| Customer Living Garage (phone-first) | `/` |
| Wallet digital service sticker | `/wallet` |
| Front counter (PDF Bridge, pipeline, inbox, vault) | `/counter` |
| Technician bay (voice-first DVI) | `/bay` |
| Verified Sale Pack | `/sale-pack/[vehicleId]` |

Quality: `npm run verify` (lint, typecheck, tests, build) · `npm run e2e:smoke` (Playwright, needs a running server).

Read next: [`docs/MORNING_BRIEFING.md`](docs/MORNING_BRIEFING.md) · [`docs/ROADMAP_AND_PLAN.md`](docs/ROADMAP_AND_PLAN.md) ·
[`DESIGN.md`](DESIGN.md) · [`CLAUDE.md`](CLAUDE.md) · source research [`docs/MARKET_RESEARCH.md`](docs/MARKET_RESEARCH.md).

All seed data is fictional (ACMA-reserved phone numbers, `.example` emails, fictional ABN and VINs).
