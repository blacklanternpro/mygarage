# CLAUDE.md — MyGarage (Companion CX & Vehicle Health layer)

Guardrails for every session in this repo. Read this first; it overrides habits and defaults.

## 1. Source of truth

- **`docs/MARKET_RESEARCH.md` is the product source of truth.** Check it before changing scope,
  copy, pricing, compliance rules or vendor choices. `docs/MARKET_RESEARCH.source.pdf` is the same
  report as a PDF (the Markdown export drops some `$` signs, e.g. "A7 billion" means A$7 billion,
  and contains stray `[span_NN]` markers; never "fix" those in the source file).
- Architecture decisions live in `docs/ROADMAP_AND_PLAN.md` (ADR log). Visual rules live in
  `DESIGN.md`. Add a new ADR entry rather than silently changing a decision.

## 2. What we are building (Option A, companion-first)

A **zero-double-entry Customer Experience (CX) & Vehicle Health layer** for independent
Australian workshops (2–10 staff, ~125–160 repair orders/month). It sits *beside* the shop's
existing WMS (MechanicDesk, Workshop Software, COSTAR…) and turns its invoices and "ones to
watch" findings into a multi-vehicle household garage on the customer's phone.

**Do NOT build:**
- a full WMS replacement (diary, job cards, inventory, parts ordering, BAS, payroll);
- per-shop native App Store apps (Apple Guideline 4.2.6 / 4.3; Google Play repetitive content).
  Native comes later only as ONE multi-shop container/picker app (Stage 4).

Four surfaces: Customer "Living Garage" PWA (magic link, no password) · Apple/Google Wallet
"Digital Service Sticker" · Front-Counter "Publish & Recover" console · Technician Voice-First
Bay DVI.

## 3. Hexagonal adapter boundary (non-negotiable)

- UI components and domain services **never** import vendor SDKs or hardcode mock data.
- Every external integration sits behind a typed interface in `src/adapters/contracts.ts`:
  `IngestionAdapter`, `NevdisAdapter`, `SmsAdapter`, `WalletPassAdapter`, `VoiceSttAdapter`,
  `MediaStorageAdapter`, `PaymentAdapter`.
- Stage 1 uses **deterministic, stateful** mocks in `src/adapters/mocks/` (no `Math.random`,
  no wall-clock-dependent IDs; state persisted via the DB `adapter_events` log).
- Selection happens only in `src/adapters/registry.ts`, driven by env flags
  (`ADAPTER_SMS=mock|live`, etc. — see `.env.example`). The UI shows MOCK vs LIVE from the registry.
- Stage 2 adds `src/adapters/live/*` implementing the same contracts. No call-site changes.
- Seed/demo data lives only in `src/db/seed-data.ts` and adapter fixtures under
  `src/adapters/mocks/fixtures/`.

## 4. Australian Consumer Law (ACL) — estimates vs quotes

- Watch-list / Amber / Red rough pricing is **always** badged exactly:
  **"Non-Binding Indicative Estimate Only — Subject to Re-Inspection & Parts Pricing"**
  (constant `ACL_ESTIMATE_LABEL` in `src/domain/compliance.ts`; never retype it).
- A **"Fixed Quote"** is a separate entity (`fixed_quotes`) with line items, GST, validity and an
  issuer. Binding only once the customer approves; approval is written to the append-only
  `quotes_and_approvals` log (timestamp, signer name, signature, approved line IDs, SHA-256 hash
  chained to the previous event). Never render an estimate range and a fixed price as one thing.
- `quotes_and_approvals` is immutable: no UPDATE/DELETE code paths; a DB trigger rejects them.
  Demo reset uses TRUNCATE only.
- Itemised bills show parts, labour hours and hourly rate (ACL itemised-bill right).

## 5. AAAA unsafe vehicle refusal

Declining any **Red / safety-critical** item must open the mandatory **5-point AAAA Unsafe
Vehicle Release Acknowledgement** and cannot complete without all five ticked, a typed full
name and a drawn signature:
1. the vehicle is unsafe to drive; 2. the mechanical reason why; 3. the potential mechanical
dangers; 4. the safety dangers to the driver, passengers and other road users; 5. the
recommendation to repair before driving or to tow. The record goes to `quotes_and_approvals`
as `UNSAFE_VEHICLE_REFUSAL` and appears in the Compliance Vault. Enforced server-side too
(`src/domain/compliance.ts`), not just in the modal.

## 6. Australian localisation

- Australian English everywhere in UI copy: tyres, colour, authorise, kilometres, licence
  (noun), centre, organise, cheque-free. Lint your own copy.
- Money: `A$` with GST clarity ("A$468.00 inc. GST"); store integer cents; GST = 1/11 of an
  inc-GST total. Use `formatAud()` from `src/domain/format.ts`.
- Dates `DD/MM/YYYY` (`formatDate()`); distances `84,200 km`; times 24h or `9:30 am`.
- Rego formats per state (WA `1HBC 429`); render with the `<Rego>` plate component.
- **Mandatory state repairer licence display** (WA `MRB…`, NSW `MVRL…`) on reports, quotes,
  invoices, the sale pack and Wallet passes — use `<LicenceTag>` / `licenceLabel()`.

## 7. Payments (post-1 October 2026 rules)

- **Zero card surcharging anywhere.** `payments.surcharge_cents` has a CHECK (= 0); fee
  calculators return the workshop's cost, never a customer add-on.
- **PayTo is the primary rail** ("Pay instantly via PayTo", workshop fee 1% + A$0.30 capped at
  A$3.50), then Stripe Card / Apple Pay / Google Pay (no surcharge).
- **BNPL** (Afterpay/Zip) only when the owner toggle is on AND the amount ≥ the workshop's BNPL
  threshold (default A$600). Never pre-selected.

## 8. Data residency, privacy & STT hygiene

- Schema targets **AWS Sydney (`ap-southeast-2`) Postgres with RLS**: every tenant table has
  `workshop_id` (FK, indexed). Every query goes through tenant-scoped repositories
  (`src/db/tenant.ts`); never query a tenant table without a `workshop_id` predicate.
- Media goes through `MediaStorageAdapter` (Cloudflare R2, zero egress, in Stage 2). PII and
  compliance PDFs stay in AWS Sydney.
- **Verified Sale Pack** export redacts owner name, residential address, phone, email and all
  payment details (`redactForSalePack()`); keep VIN, rego, odometer and service history.
- Speech-to-text: **Deepgram Nova-3** (primary) or **OpenAI `gpt-transcribe`**. Do NOT use
  `whisper-1` or `gpt-4o-transcribe` (API removal scheduled 26 Feb 2027).
- Never send PII to third-party AI APIs without explicit consent (Apple 5.1.2(i); APP ADM rules).
- Never commit secrets. `.env*` (except `.env.example`) and `.data/` are git-ignored.

## 9. Stack & commands (Stage 1)

Next.js App Router (TypeScript strict) · Tailwind CSS v4 · Drizzle ORM · PGlite (embedded
Postgres in WASM, persisted to `.data/pglite`) · Zod · Vitest.

```bash
npm install
npm run db:seed      # idempotent reset + seed (stop `npm run dev` first; PGlite is single-process)
npm run dev          # http://localhost:3000 (auto-migrates + auto-seeds an empty DB)
npm run typecheck    # tsc --noEmit
npm test             # vitest (in-memory PGlite; no Docker)
npm run build        # production build must stay green
npm run db:generate  # drizzle-kit generate after schema changes; commit drizzle/ migrations
```

- Dynamic route `params`/`searchParams` are Promises — always `await` them.
- Pages that read the DB export `dynamic = "force-dynamic"`; DB init is lazy (never at import).
- Fonts are self-hosted via `next/font/local` (`src/app/fonts/`); no network fonts at build.
- Mutations: route handlers under `src/app/api/**` validate input with Zod, call a domain
  service, return JSON. Client components then `router.refresh()`.

## 10. Code map

```
src/adapters/   contracts.ts · registry.ts · mocks/ · live/ (Stage 2)
src/db/         schema.ts · client.ts · tenant.ts · seed.ts · seed-data.ts
src/domain/     compliance.ts · format.ts · garage.ts · quotes.ts · bridge.ts · dvi.ts · pipeline.ts · wallet.ts · payments.ts
src/app/        /(garage) · /counter · /bay · /sale-pack/[vehicleId] · /api/**
src/components/ chrome/ · garage/ · counter/ · bay/ · wallet/ · diagrams/ · ui/
tests/          unit + integration (vitest)
```

## 11. Quality bar

- Run the project skill **`au-auto-prototype-qa`** before calling any UI work done
  (390×844 mobile ergonomics, 48px+ bay touch targets, ACL badges, licence display, zero
  surcharge, AAAA modal).
- `npm run typecheck && npm test && npm run build` green before every push.
- No external image URLs; diagrams are inline SVG components in `src/components/diagrams/`.
- Design: follow `DESIGN.md` (modern-industrial editorial; no purple gradients, no glassmorphism).

## 12. Git

- Work on a branch, never commit straight to `main`. Commit + push at each milestone.
- Conventional-ish messages (`feat:`, `fix:`, `docs:`, `test:`). Never commit `.env`, `.data/`,
  credentials or real customer data.
