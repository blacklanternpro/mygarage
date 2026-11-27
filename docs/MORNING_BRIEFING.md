# Morning briefing: Stage 1 build (overnight run, 27/11/2026)

**Status: Stage 1 is built, verified and pushed.** Branch `claude/stage-1-companion-cx`, PR into `main`.
Lint, typecheck, 39 unit/integration tests, the production build and a 23-check headless-Chrome
E2E run (390×844 and 1440×900, against the production build) all pass.

---

## 1. Run it locally

```bash
npm install
npm run db:seed     # optional: the server also auto-seeds an empty database on first request
npm run dev         # → http://localhost:3000
```

- Needs **Node 20.9+** (built on Node 22). No Docker or database server: Postgres runs embedded
  (PGlite) and lives in the `.data/` folder. Works the same in PowerShell on Windows.
- **Reset the demo** at any time from the dark demo bar (↻ Reset demo) or `POST /api/demo/reset`.
- Don't run `npm run db:seed` while the dev server is running (PGlite is single-process). The
  script detects a running server and refuses. Use the in-app reset instead. To start completely
  fresh: stop the server and delete `.data/`.
- Full check: `npm run verify` (lint → typecheck → tests → production build).
  E2E: start a server, then `SMOKE_URL=http://localhost:3000 npm run e2e:smoke` (screenshots land
  in `test-results/smoke/`; it resets the demo when done).

## 2. What was built

| Surface | Where | Highlights |
|---|---|---|
| Demo chrome | every page | Collapsible bar: Customer phone / Front counter / Bay tablet switcher, live **Adapter Inspector** (7 ports, MOCK/LIVE, recent calls), **SMS magic-link flow** preview, one-click reset |
| Customer Living Garage | `/` | Lands straight in the Hartley household. Shop band with **WA Repairer Licence MRB8421**, 3-vehicle switcher (rego, km, rego expiry, service due, health), tailgate-badge hero, **Health roadmap**: Red / Amber "Ones to watch" / Green (collapsed). Annotated SVG visuals (brake pad gauge, weeping shock, battery test, tyre tread, drive belt). Every rough price carries the exact **ACL badge** in a dashed box; Fixed Quotes are solid, double-ruled, itemised (labour hours × rate), GST, validity, issuer, licence |
| Customer actions | sheets on `/` | Book it in · Request fixed quote · Plan for later (1 mo / 3 mo / next service) · Mark resolved elsewhere · **Approve fixed quote** line by line with typed name + drawn signature · **Decline** a Red item → mandatory **5-point AAAA acknowledgement** · checkout (**PayTo first**, no surcharge, BNPL only over the owner's threshold) |
| History & resale | `/`, `/sale-pack/[id]` | Verified service timeline with itemised lines + **downloadable invoice PDFs**; printable **Verified Sale Pack** with owner name, address, phone, email and payment details removed, plus a SHA-256 verification code |
| Requests & messages | `/` | 24/7 booking (tick watch-list items, loan car, drop-off), 4x4/mod quote form (VIN + variant auto-attached, on-device photo compression), per-vehicle message thread, mod-quote threads |
| Wallet "Digital Service Sticker" | `/wallet`, Wallet sheet | Front/back pass with real QR, versioned payload that changes only when the customer would see a difference, **simulated lock-screen push**, mock pass.json / Google object |
| Front counter | `/counter` | **PDF Bridge** (drag-drop or *Load sample MechanicDesk invoice PDF*, animated OCR → extraction steps, **10-second review gate**, Approve & publish) · **Rainy-day pipeline** (A$ recoverable, ranked by value × age, **Fill quiet Tuesday bay** SMS preview + send) · **Triage inbox** · **Bay DVI review** · **Compliance Vault** (hash-chain verified, AAAA acknowledgements, signatures) · payment settings |
| Technician bay | `/bay` | High-contrast sunlit UI, 48px+ targets, **Hold to dictate** (pointer or Space), 5 pre-loaded mechanic clips, jargon → plain-English draft, RAG buttons, estimate, tap-to-circle markup, save for advisor review |

**Under the hood:** Next.js 16.4 App Router (Cache Components, async params), TypeScript strict,
Tailwind v4, Drizzle ORM on PGlite with **`workshop_id` on every tenant table** (RLS policies
ready in `docs/sql/rls-policies.sql`), 19 tables, 27 API routes (Zod-validated), 7 hexagonal
ports with deterministic stateful mocks + live stubs, an **append-only compliance log** (DB
trigger blocks UPDATE/DELETE, SHA-256 hash chain detects tampering), a **DB CHECK that makes
card surcharging impossible**, and server-side signature sanitising.

Screenshots: `docs/screenshots/` (01–08).

## 3. Verification results

| Check | Result |
|---|---|
| `npm run lint` | ✅ clean |
| `npm run typecheck` | ✅ clean |
| `npm test` | ✅ 39/39 (ACL label, AAAA enforcement, hash chain + tamper detection, immutability trigger, zero surcharge CHECK, PayTo cap maths, BNPL rules, PDF extraction, DVI structuring, bridge publish → garage + wallet, pipeline, triage, tenant isolation, signature XSS) |
| `npm run build` | ✅ (`/` Partial Prerender, APIs dynamic) |
| E2E smoke on production build | ✅ 23/23. Includes **PDF Bridge publish → Customer Garage + Wallet pass update**, **Red decline → AAAA 5-point modal + vault record**, **customer mod quote → triage inbox**, quote approval + PayTo payment, bay dictation → counter review → garage, no horizontal overflow at 390 and 1440, 44px+ customer and 48px+ bay targets, zero console errors |
| `au-auto-prototype-qa` skill | ✅ A–G pass. Licence shown on header, quotes, invoices, Sale Pack, pass back, counter. No US spellings, no external images, every "surcharge" mention is "no surcharge" |

## 4. Decisions I made for you (logged in `docs/ROADMAP_AND_PLAN.md`)

1. **Research doc**: the exact `curl` export worked (HTTP 200, genuine Markdown), so no
   `FETCH_BLOCKED.md`. I also committed your PDF copy as `docs/MARKET_RESEARCH.source.pdf`, because the
   Markdown export drops some `$` signs (e.g. "A7 billion").
2. **2016 Ranger "timing belt"**: the PX Ranger 3.2 has a **timing chain**, not a belt. A mechanic
   would spot that in a demo, so the watch item is now *"150,000 km major service coming up"*
   (drive belt, fluids, fuel filter), and the customer copy says there's no timing belt to replace.
3. **Sample invoice is for Bec's Mazda CX-5** (all green, service due in 24 days). Publishing it
   visibly turns the car Amber (rear tyres 3.5 mm, wipers), moves the next service to 77,540 km
   and bumps the Wallet pass. The bundled PDF is dated 27/11/2026.
4. **BNPL threshold A$600** (the research's example). The A$468 brake quote shows BNPL as
   unavailable; the A$3,300 2" lift quote offers it. Change it under Counter → Payments & setup.
5. **Brake pads have a seeded Fixed Quote (Q-24117, A$468.00)** so Approve and Decline both work
   on the Red item. The 2" lift thread has Fixed Quote Q-24109 (A$3,300.00) waiting for approval.
6. **No login wall in Stage 1**: the session is the seeded household. The magic-link flow is a
   faithful preview (mock SMS, token, 15-min expiry copy).
7. **AAAA 5 points** come straight from research §6: unsafe to drive · mechanical reason ·
   mechanical dangers · safety dangers to driver/others · repair-or-tow recommendation. Enforced
   server-side (HTTP 422), not just in the modal.
8. **Fictional contact details**: ACMA-reserved numbers (0491 570 xxx, 08 5550 xxxx), `.example`
   emails, fictional ABN/VINs.

## 5. Rough edges and follow-ups (for the desktop session)

- **Fixed Quote builder at the counter**: customers can *request* a fixed quote and it lands in
  the triage inbox, but the advisor can't compose a new Fixed Quote in the UI yet (only seeded
  ones exist). Highest-value Stage 1.5 item.
- **Real microphone capture** in the bay isn't wired; the hold button uses the pre-loaded clips
  (or typed text). The STT port is ready for Deepgram Nova-3.
- **Scanned PDFs**: the mock OCR reads digital PDFs only. Scanned invoices need the Stage 2 OCR provider.
- **No DB transactions in actions** (PGlite has a single connection and mocks log through it).
  With node-postgres in Stage 2, wrap actions in transactions and use an outbox for SMS/push.
- **Wallet "Add to"** returns the unsigned pass JSON; real `.pkpass` signing is Stage 2.
- **Photos** are stored in a Postgres blob table by the media mock; R2 in Stage 2.
- **Sheet focus handling** is basic (focus in/out + Esc). Add a full focus trap before the pilot.
- The Next.js "N" badge bottom-left is the dev-mode indicator; it isn't there under `npm start`.

## 6. Three-minute local mechanic demo script

> Open on a laptop at `http://localhost:3000` and hit **Reset demo** first. Hand the phone view over
> by narrowing the window, or use Chrome devtools at 390×844.

**0:00 — The customer's phone (Customer phone).** "This is what Bec gets from one SMS: no app, no
password. Your name and licence up top, all three of the family's cars. The HiLux shows **1
urgent**: front pads at 2 mm, with the gauge Jordan would point at on the hoist."

**0:30 — Ones to watch.** Scroll to the battery and rear shocks. "Every rough price has the
non-binding estimate badge, so nobody can say you quoted them. They can **Plan for later**
(tap *In 3 months*) and the reminder lands on their lock screen."

**0:55 — Fixed Quote vs decline.** On the brake pads tap **Decline**. "If they say no to a safety
item, they can't skip this: the AAAA five points, their name and a signature. It's stored and can't
be edited." Close it and show **Approve fixed quote** instead: untick nothing, type the name, sign.

**1:25 — Front counter → PDF Bridge.** Switch to **Front counter**. Tap **Load sample MechanicDesk
invoice PDF**. "That's the PDF you already print. It's read in a couple of seconds. You glance for
ten seconds and hit **Approve & publish**." Then **Open the customer garage**: the CX-5 is now Amber
with the rear tyres, next service updated, and the Wallet pass bumped.

**2:05 — Money on the table.** Tab **Rainy-day pipeline**: "Over A$8,000 of work your customers
already said 'later' to. Quiet Tuesday? **Fill quiet Tue bay**, check the texts, send."

**2:30 — The bay.** **Bay tablet** → pick the CX-5 → hold **Hold to dictate finding** for a second.
"Jordan says 'left rear shock misting oil, 400 to 450 bucks', and the customer reads plain
English. It waits for Kirsty at the counter before anyone sees it."

**2:50 — Close.** Counter → **Compliance vault**: "Every approval and refusal, timestamped and
sealed. Works beside MechanicDesk. Nothing to migrate."

## 7. Stage 2 starting checklist

- [ ] AWS account in **ap-southeast-2**; RDS Postgres; set `DATABASE_URL`; swap `openDatabase()` to
      `drizzle-orm/node-postgres`; run migrations; apply `docs/sql/rls-policies.sql` with a non-owner role
- [ ] Real magic-link auth: hashed single-use tokens (15 min), session cookie, workshop from subdomain
- [ ] **IngestionAdapter (live)**: Textract DetectDocumentText or Azure Read → Gemini Flash-Lite
      JSON schema; email-BCC inbound address; keep the review gate; per-template accuracy tracking
- [ ] **Xero** read-sync (invoices + attachments, contacts). Register the app, OAuth2, webhooks
- [ ] **NevdisAdapter**: apply to BlueFlag or InfoAgent (ABN approval); keep the `nevdis_lookups` cache
- [ ] **SmsAdapter**: Texto or DataFlows account; ACMA Sender ID registration for each workshop
- [ ] **MediaStorageAdapter**: Cloudflare R2 bucket, signed URLs, client compression already in place
- [ ] **WalletPassAdapter**: Apple Developer Pass Type ID cert (US$99/yr), pass web service endpoints,
      APNs; Google Wallet issuer + service account
- [ ] Wrap actions in DB transactions + outbox; BullMQ/Redis for retries and dead letters
- [ ] Counter Fixed Quote builder; privacy policy + Controller/Processor DPA drafts
- [ ] Flip each `ADAPTER_*` env flag to `live` one at a time. The Inspector shows the switch

## 8. Where things are

`CLAUDE.md` guardrails · `DESIGN.md` visual system · `docs/ROADMAP_AND_PLAN.md` roadmap, ADRs, data
model · `src/adapters/` ports, mocks, live stubs, registry · `src/domain/` business rules ·
`src/db/` schema, seed, tenancy · `src/app/api/` routes · `tests/` · `scripts/smoke.ts` ·
`.claude/skills/au-auto-prototype-qa/` QA gate.
