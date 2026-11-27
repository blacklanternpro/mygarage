# MyGarage: Roadmap, architecture & decision log

> Source of truth: `docs/MARKET_RESEARCH.md` (section numbers below refer to it).
> Guardrails: `CLAUDE.md`. Visual system: `DESIGN.md`.
> Status: **Stage 1 in progress** (overnight autonomous build, 27/11/2026).

---

## 0. Product thesis (one paragraph)

Independent Australian workshops (median 125 ROs/month, ~7 staff; §1) already run a WMS they
won't leave (MechanicDesk, Workshop Software, COSTAR; §2, §4). Their customers lose the paper
invoice and the "ones to watch" sheet, defer work they can't budget for (47% of drivers delay
maintenance; §1), and the shop loses the follow-up revenue. MyGarage is the **companion layer**
(Option A, §7): it ingests what the shop already produces (PDF invoices, Xero, optional bay DVI)
with **zero double entry**, and publishes it to a passwordless, shop-branded **household
garage** plus a **Wallet "digital service sticker"** that replaces the windscreen sticker (§5).
The counter gets a 10-second review gate and a "rainy day" pipeline of deferred work (§3).

Go/no-go metrics carried from the research (§8 Stage 0): SMS magic-link click > 70% · Wallet card
install > 35% · watch-list interaction rate · counter effort < 30 s per vehicle.

---

## 1. Four-stage build roadmap

### Stage 1: Foundation + interactive prototype (tonight)

Goal: a production-shaped, multi-tenant codebase you can demo to a local mechanic on a phone
and a laptop, where every click writes to a real database and every vendor is a typed mock.

| Area | Scope |
|---|---|
| Platform | Next.js 16 App Router (TS strict), Tailwind v4, Drizzle ORM, PGlite embedded Postgres, Zod, Vitest |
| Tenancy | `workshop_id` on every tenant table, tenant-scoped repositories, RLS-ready schema |
| Adapters | 7 typed ports + deterministic stateful mocks + registry with MOCK/LIVE status |
| Seed | *South West Mechanical & 4x4* (Bunbury/Australind WA, MRB8421, MechanicDesk) · Hartley household (HiLux / CX-5 / Ranger) · supporting households for the pipeline |
| Customer | Living Garage PWA: vehicle switcher, Ones-to-Watch roadmap, ACL estimates, Fixed Quote approval with signature, AAAA refusal, plan-for-later, resolved-elsewhere, service timeline, Verified Sale Pack, booking, mod-quote form, vehicle thread, checkout drawer |
| Wallet | Front/back pass preview from live DB, versioned payload, simulated lock-screen push |
| Counter | PDF Bridge simulator (real bundled sample PDF, real text extraction) → 10-second review gate → publish; rainy-day pipeline + "Fill quiet Tuesday bay"; triage inbox; Compliance Vault (hash-chain verification); DVI review queue; payment toggles |
| Bay | Voice-first DVI: hold to dictate, preloaded clips, jargon → plain-English finding + indicative estimate, photo annotation, save for advisor review |
| Quality | typecheck, unit + integration tests, production build, API smoke, headless DOM checks at 390×844 and 1440×900 |

Exit criteria: all green; demo resettable in one click; morning briefing with walkthrough.

### Stage 2: Live integrations (adapters go LIVE one by one)

| Port | Live provider | Notes |
|---|---|---|
| `IngestionAdapter` | Decoupled OCR (AWS Textract DetectDocumentText or Azure Read) → **Gemini Flash-Lite** structured JSON | ~A$4.62/1,000 pages (§4, §7). Email-BCC inbox (`publish@<shop>.app`) + print-to-cloud driver. Keep the review gate; auto-publish only after > 98% accuracy over 50 consecutive jobs per template |
| Accounting read-sync | **Xero Accounting API** (invoices + attachments, contacts) | Tier 1 of the bridge: works even when the WMS API is closed |
| `NevdisAdapter` | **BlueFlag** or **InfoAgent** (MotorWeb/AutoGrab fallback) | Cache every plate/VIN on first sight (`nevdis_lookups`), illustrative A$0.30/lookup |
| `SmsAdapter` | **Texto** (3.0c flat) or **DataFlows / Mobile Message** (2.5–3.5c) | ACMA-registered Sender ID; real magic-link tokens (hashed, 15-min TTL, single use) |
| `MediaStorageAdapter` | **Cloudflare R2** (S3 API, zero egress) | Client-side compression (~400 KB images, 720p clips); signed URLs; PII stays in AWS Sydney |
| `WalletPassAdapter` | In-house **Apple PassKit** signing (Pass Type ID cert, APNs updates) + **Google Wallet** generic objects (JWT) | US$99/yr Apple, $0 Google; pass web service endpoints (`/v1/devices/...`) |
| Infra | AWS Sydney `ap-southeast-2`: RDS Postgres with RLS policies from `workshop_id`, Redis/BullMQ for webhooks, retries and dead letters | Point Drizzle at RDS; PGlite stays for tests |

### Stage 3: 5-shop pilot hardening

- Live **Deepgram Nova-3** (or OpenAI `gpt-transcribe`) behind `VoiceSttAdapter`; never `whisper-1`
  or `gpt-4o-transcribe` (removal 26/02/2027). Offline-capable capture, 15-second clips, < 8 min per inspection.
- **Stripe Australia** behind `PaymentAdapter`: **PayTo** primary (1% + A$0.30, capped A$3.50),
  card / Apple Pay / Google Pay at 1.65% + A$0.30 with **zero surcharge**, owner-toggled BNPL
  (Afterpay/Zip) above the shop's threshold (default A$600).
- Automated multi-trigger reminders: whichever arrives first of next-service date, interpolated
  km threshold, rego expiry, or the customer's plan-for-later timer. Wallet push first, SMS fallback.
- APP-aligned privacy policy, Controller (workshop) / Processor (us) DPA, ADM transparency
  (10/12/2026), consent before AI processing (Apple 5.1.2(i)), penetration test, "Vehicle sold /
  disconnect owner" PII scrub with transferable anonymised log.
- Pilot metrics dashboard against the §8 go/no-go thresholds; locked beta pricing (e.g. A$99/mo + GST).

### Stage 4: Direct WMS APIs + unified container app

- Direct 2-way WMS APIs: **Workshop Software Platinum** (REST + Public Booking API),
  **MechAxis** (Platinum), later Tekmetric; copy DVI summaries + permalinks back into WMS notes.
- One multi-shop **React Native / Expo container ("picker") app** under the platform brand
  (Apple 4.2.6-compliant): scan a shop QR to theme, biometrics, offline garage, native push.
- Ecosystem: resale passport transfer-to-new-owner, household shared access, fitment-aware 4x4
  quoting, fleet portal (3–10 utes), OEM schedules via InfoAgent/HaynesPro add-on.

---

## 2. Architecture

```
                 ┌──────────── Next.js App Router (Node runtime) ────────────┐
 Customer PWA ──►│  /            Living Garage (server components + islands)  │
 Wallet preview ►│  /wallet      Pass preview                                 │
 Counter ───────►│  /counter     Publish & Recover console                    │
 Bay tablet ────►│  /bay         Voice-first DVI                              │
                 │  /api/**      Route handlers: Zod → domain service → JSON  │
                 └───────────────┬───────────────────────────┬───────────────┘
                                 │                           │
                       ┌─────────▼─────────┐       ┌─────────▼─────────┐
                       │  Domain services  │──────►│  Adapter registry │── env flags
                       │  (pure TS, no I/O │ ports │  MOCK | LIVE      │
                       │   vendors)        │       └─────────┬─────────┘
                       └─────────┬─────────┘                 │
                                 │ tenant-scoped repos       │ mocks log to adapter_events
                       ┌─────────▼─────────────────────────────────────────┐
                       │ Drizzle ORM → PGlite (Stage 1) → RDS Postgres + RLS │
                       └───────────────────────────────────────────────────┘
```

Zero-double-entry bridge (§4), Stage 1 shape:

```
PDF (drop / sample) → IngestionAdapter.extractInvoice()
   ├─ step 1 OCR text (mock: real text extraction from the PDF content streams)
   ├─ step 2 LLM structuring (mock: deterministic field mapper + confidence)
   └─ ingestion_jobs (IN_REVIEW) → 10-second review gate (counter) → publish
         → service_records (+ itemised lines) → vehicle odometer / next-service
         → findings (Ones to Watch) → wallet_passes (version++, payload hash) → reminders
```

---

## 3. Decision log (ADRs)

| # | Decision | Why | Revisit when |
|---|---|---|---|
| ADR-001 | **Next.js 16.4 App Router, TS strict, Tailwind v4.** `cacheComponents` + `partialPrefetching` on (framework default). DB-reading UI sits inside `<Suspense>` and calls `await connection()` first; `params`/`searchParams` are awaited Promises | Matches current conventions; static shell + streamed data gives sub-2 s loads (§7) | Never (baseline) |
| ADR-002 | **Drizzle ORM + PGlite** (WASM Postgres, persisted to `.data/pglite`); in-memory PGlite for tests | Zero Docker, real Postgres dialect (jsonb, CHECK, triggers, plpgsql), same Drizzle schema runs on RDS | Stage 2: swap driver to `node-postgres` against AWS Sydney |
| ADR-003 | **Tenancy:** `workshop_id uuid NOT NULL` + index on every tenant table; all access through `forWorkshop(workshopId)` repositories | RLS-ready; Stage 2 adds `CREATE POLICY ... USING (workshop_id = current_setting('app.workshop_id')::uuid)` without query changes | Stage 2 |
| ADR-004 | **Hexagonal ports** in `src/adapters/contracts.ts`; registry picks mock/live from `ADAPTER_<PORT>` env flags; live stubs throw `AdapterNotConfiguredError` | Stage 2 swaps providers without touching UI/domain; Inspector shows MOCK/LIVE truthfully | Each Stage 2 integration |
| ADR-005 | **Mocks are deterministic and stateful:** IDs derived from SHA-256 of inputs + a per-port sequence stored in `adapter_events`; no `Math.random` | Repeatable demos and tests; the Inspector can replay calls | — |
| ADR-006 | **Immutable compliance log** `quotes_and_approvals`: append-only, plpgsql trigger blocks UPDATE/DELETE, each row stores `content_hash = sha256(prev_hash + canonical JSON)` | ACL dispute defence (§6); tamper evidence without a blockchain | Stage 3: also anchor daily root hash to S3 Object Lock |
| ADR-007 | **ACL estimate vs Fixed Quote are different tables and components.** Estimates live on `findings` (low/high cents, always badged); Fixed Quotes live in `fixed_quotes` with line items | Makes it impossible to render one as the other (§6) | — |
| ADR-008 | **AAAA refusal enforced in the domain** (`assertUnsafeRefusalComplete`): 5 acknowledgements + name + signature, else HTTP 422 | UI can't be bypassed (§6) | — |
| ADR-009 | **Money as integer cents, inc-GST storage, GST = round(total/11)**; `formatAud()` | Avoids float drift; matches AU invoices | — |
| ADR-010 | **Payments:** rail fee table in `src/domain/payments.ts`; `payments.surcharge_cents` CHECK = 0; BNPL visible only if `workshops.bnpl_enabled` and amount ≥ `bnpl_min_cents` (default A$600) | Post-1 Oct 2026 surcharge ban (§6) | Stage 3 Stripe |
| ADR-011 | **Auth in Stage 1 = simulated magic link.** The demo session is the seeded household; the "Preview SMS magic-link flow" modal sends a real (mock) SMS with a deterministic token and walks the verify step | No login wall for the demo; contract shaped for Stage 2 tokens | Stage 2 |
| ADR-012 | **Mutations through route handlers** (`/api/**`, Zod-validated), clients call `router.refresh()` | Curl-testable, explicit HTTP contract for Stage 2 mobile/container app | — |
| ADR-013 | **Fonts self-hosted** (Archivo variable + Martian Mono variable, OFL) via `next/font/local` | Builds offline; no third-party font requests (privacy) | — |
| ADR-014 | **Voice → finding structuring is a pure domain function** (`structureDictation`) over the STT transcript (component, side, condition, horizon, price range) | Deterministic in Stage 1; Stage 3 can put an LLM behind a port with the same output schema | Stage 3 |
| ADR-015 | **Sample PDF is generated (pdf-lib) and committed** to `public/samples/`; the mock OCR genuinely reads its text | The bridge demo is real end to end, not a canned animation | Stage 2 real OCR |
| ADR-016 | **Demo clock:** `now()` honours `DEMO_NOW` (ISO) for tests; seed dates are relative to now (service due +24 d, rego +41 d) | Demo always looks current; tests are stable | — |

---

## 4. Data model (Stage 1 schema, all tenant tables carry `workshop_id`)

| Table | Key columns |
|---|---|
| `workshops` | slug, name, suburb/state/postcode, abn, phone, `licence_state`, `licence_type` (MRB/MVRL), `licence_number`, wms, staff_count, brand colours, `payto_enabled`, `card_enabled`, `bnpl_enabled`, `bnpl_min_cents`, labour_rate_cents |
| `households` | name, primary_customer_id |
| `customers` | household_id, names, mobile, email, address (PII), sms_opt_in, role |
| `vehicles` | household_id, rego, rego_state, rego_expiry, make/model/variant/year, vin, colour, odometer_km, avg_km_per_day, next_service_due_date/km |
| `service_records` | vehicle_id, invoice_number, source (MECHANICDESK_PDF/BAY_DVI/SEED), service_date, odometer, summary, `line_items` jsonb (kind PART/LABOUR/FEE, qty, hours, rate), subtotal/gst/total cents, technician, verified, published_at, pdf_path, payment_note (PII) |
| `inspection_reports` | vehicle_id, service_record_id?, inspected_at, odometer, technician, status |
| `findings` | vehicle_id, inspection_report_id, `severity` (URGENT_RED/WATCH_AMBER/HEALTHY_GREEN), category, title, customer_explanation, technician_note, measurement, diagram, horizon_text/km/date, estimate_low/high cents, status (OPEN/QUOTE_REQUESTED/QUOTED/APPROVED/BOOKED/PLANNED/DECLINED/RESOLVED_ELSEWHERE/COMPLETED), review_status (PUBLISHED/PENDING_REVIEW), planned_remind_at, source |
| `fixed_quotes` | vehicle_id, finding_ids, mod_quote_request_id?, quote_number, title, line_items jsonb, subtotal/gst/total, valid_until, status (ISSUED/APPROVED/DECLINED), issued_by |
| `quotes_and_approvals` | **append-only**: event_type (QUOTE_ISSUED/QUOTE_APPROVED/QUOTE_DECLINED/UNSAFE_VEHICLE_REFUSAL/ESTIMATE_PLANNED/RESOLVED_ELSEWHERE), vehicle/finding/quote ids, signer_name, signature_svg, acknowledgements jsonb, payload jsonb, prev_hash, content_hash, occurred_at |
| `mod_quote_requests` | vehicle_id, customer_id, mod_type, title, description, usage, budget_band, vin/variant snapshot, photo keys, status |
| `bookings` | vehicle_id, finding_ids, requested_date, drop_off, loan_car, notes, status |
| `messages` | vehicle_id, thread (VEHICLE/MOD), mod_quote_request_id?, author_role, author_name, body, channel |
| `reminders` | vehicle_id, finding_id?, kind (SERVICE_DUE/REGO_EXPIRY/WATCH_ITEM/CAMPAIGN), channel, scheduled_for, status, campaign_key |
| `wallet_passes` | vehicle_id, serial, version, payload jsonb, payload_hash, last_push_at |
| `payments` | vehicle_id, quote_id, rail, amount, workshop_fee, `surcharge_cents CHECK (= 0)`, status |
| `ingestion_jobs` | filename, status, extracted jsonb, confidence, steps jsonb, service_record_id |
| `media_assets` | key, kind, content_type, bytes, vehicle_id? |
| `nevdis_lookups` | rego, state, payload, fetched_at (cache) |
| `adapter_events` | port, operation, request, response, sequence, created_at (mock state + Inspector) |

---

## 5. Adapter contracts

| Port | Stage 1 mock (deterministic) | Stage 2+ provider | Env flag |
|---|---|---|---|
| IngestionAdapter | Extracts text from PDF content streams (zlib), maps fields with rules, returns steps + confidence | Textract/Azure Read + Gemini Flash-Lite | `ADAPTER_INGESTION` |
| NevdisAdapter | Fixture registry keyed by state + rego | BlueFlag / InfoAgent | `ADAPTER_NEVDIS` |
| SmsAdapter | Writes outbox to `adapter_events`, segments + 3.0c cost estimate | Texto / DataFlows | `ADAPTER_SMS` |
| WalletPassAdapter | Builds PassKit `pass.json` + Google generic object, SHA-256 "signature", push log | In-house PassKit + Google Wallet | `ADAPTER_WALLET` |
| VoiceSttAdapter | Returns transcripts for preloaded bay clips (model label `deepgram-nova-3 (mock)`) | Deepgram Nova-3 / `gpt-transcribe` | `ADAPTER_STT` |
| MediaStorageAdapter | Stores bytes in `media_assets`, returns `r2://` keys + local URLs | Cloudflare R2 | `ADAPTER_MEDIA` |
| PaymentAdapter | Fee quotes per rail, deterministic intent IDs, PayTo mandate simulation | Stripe AU (PayTo, card, wallets, BNPL) | `ADAPTER_PAYMENT` |

---

## 6. Compliance → implementation → test

| Rule (research §6) | Implementation | Test |
|---|---|---|
| Estimate ≠ quote (ACL) | `ACL_ESTIMATE_LABEL`, `EstimateBox` vs `FixedQuote`, separate tables | `compliance.test.ts` label constant; render guard |
| Timestamped line-item approvals | `approveFixedQuote()` → hash-chained event | chain verification + tamper detection test |
| Immutability | plpgsql trigger on `quotes_and_approvals` | UPDATE/DELETE throw in integration test |
| AAAA unsafe vehicle refusal | `assertUnsafeRefusalComplete()` + modal | 422 on incomplete, record on complete |
| State licence display | `licenceLabel()` on header, quote, report, sale pack, pass | wallet payload contains licence |
| No surcharge | CHECK constraint + fee calculator | inserting surcharge fails; fee math |
| BNPL owner toggle | `availableRails()` | rails by toggle/threshold |
| Sale Pack redaction | `redactForSalePack()` | no PII keys/values in output |
| Data residency | schema + docs; Stage 2 infra in `ap-southeast-2` | n/a (infra) |
| STT hygiene | contract model enum excludes `whisper-1`/`gpt-4o-transcribe` | registry test |

---

## 7. Stage 1 milestones (checkpoint commits)

1. **M1:** scaffold, schema + migrations, adapters + registry, seed + reset + auto-seed, domain services, tests.
2. **M2:** demo switcher/inspector, Customer Living Garage, Wallet pass.
3. **M3:** Front-counter console (bridge, pipeline, triage, vault, DVI queue), technician bay.
4. **M4:** verification (typecheck, tests, build, API smoke, DOM smoke), polish, `docs/MORNING_BRIEFING.md`, PR.

## 8. Risks for Stage 1 specifically

| Risk | Mitigation |
|---|---|
| PGlite is single-process: `db:seed` while `next dev` runs could corrupt the data dir | Documented; Reset Demo API works in-process; seed script refuses to run if a lock file shows a live dev server |
| Cache Components prerender touching the DB at build | All DB reads after `await connection()` inside Suspense; lazy DB singleton |
| Next 16 conventions differ from older examples | Followed bundled docs in `node_modules/next/dist/docs` |
| No live vendors tonight | Every port is a typed mock with a LIVE stub; Inspector is explicit about MOCK |
