---
name: au-auto-prototype-qa
description: QA gate for the MyGarage Australian workshop prototype. Use before marking any UI, copy, quote, payment, wallet-pass or DVI work as done, and whenever a screen, flow or compliance string changes. Checks 390x844 mobile ergonomics, 48px+ sunlit-bay touch targets, ACL estimate-vs-quote labelling, state repairer licence display, zero card surcharging and the 5-point AAAA unsafe-vehicle refusal modal.
---

# AU Auto Prototype QA

Run this checklist against every changed surface. A single FAIL blocks "done". Record results
(PASS/FAIL + note) in the PR description or `docs/MORNING_BRIEFING.md`.

## How to run

1. `npm run typecheck && npm test && npm run build` must pass first.
2. Boot the app (`npm run dev`), reset demo state (Demo Switcher → Reset, or
   `curl -X POST localhost:3000/api/demo/reset`).
3. If a headless browser is available, run `npm run e2e:smoke` (Playwright DOM checks at
   390×844 and 1440×900). Otherwise check manually with devtools device mode.
4. Walk each section below on the surfaces you touched.

## A. Mobile ergonomics — Customer Garage (390×844)

- [ ] No horizontal scroll at 390px (`document.documentElement.scrollWidth <= 390`).
- [ ] Primary actions sit within thumb reach (bottom half) or in a sticky action bar.
- [ ] Body text ≥ 16px; secondary ≥ 13px; nothing below 12px except legal footers.
- [ ] Touch targets ≥ 44×44px on customer surfaces; spacing ≥ 8px between targets.
- [ ] Vehicle switcher cards show rego, km, rego expiry, next service due, health badge.
- [ ] Green "Healthy" group is collapsed by default.
- [ ] Modals/drawers fit 844px height with internal scroll and a visible close control.

## B. Sunlit-bay technician mode (tablet & phone)

- [ ] Every interactive control ≥ **48×48px** (primary actions ≥ 64px tall).
- [ ] Contrast ≥ 7:1 for text on the bay surface (WCAG AAA); no light-grey-on-white.
- [ ] Status is never colour-only: RAG buttons carry text labels + icons/shape.
- [ ] "Hold to Dictate" works with pointer *and* keyboard (Space/Enter hold) and shows state.
- [ ] Usable with one gloved thumb: no hover-only affordances, no tiny close icons.

## C. Australian Consumer Law

- [ ] Every Red/Amber rough price shows the exact badge
      **"Non-Binding Indicative Estimate Only — Subject to Re-Inspection & Parts Pricing"**
      (sourced from `ACL_ESTIMATE_LABEL`, never retyped).
- [ ] Estimate ranges and Fixed Quotes are visually distinct (badge, typography, border).
- [ ] Fixed Quotes show quote number, line items (parts / labour hours × rate), GST, total
      inc. GST, validity date and issuer.
- [ ] Approving a Fixed Quote captures typed name + signature and writes a timestamped,
      hash-chained `QUOTE_APPROVED` event (visible in the Compliance Vault).
- [ ] No copy implies an estimate is a price ("from", "only", "guaranteed" are banned on estimates).

## D. AAAA unsafe vehicle refusal

- [ ] Declining a **Red** item opens the 5-point acknowledgement — there is no other decline path.
- [ ] All 5 points present: unsafe to drive · mechanical reason · mechanical dangers ·
      safety dangers to driver/others · repair-or-tow recommendation.
- [ ] Submit is disabled until all 5 are ticked, full name typed and signature drawn.
- [ ] API rejects an incomplete refusal (HTTP 422) even if the UI is bypassed.
- [ ] Record appears in the Compliance Vault with timestamp, signer and hash.
- [ ] Declining an Amber item does NOT require the AAAA modal (simple confirm).

## E. Licence & localisation

- [ ] State repairer licence (e.g. "WA Repairer Licence MRB8421") visible on: garage header,
      every Fixed Quote, every inspection report, invoices/timeline, Sale Pack, Wallet pass
      (front or back), counter console header.
- [ ] Australian English: tyres, colour, authorise, kilometres, licence, centre. Grep for
      `tire|color(?!:)|authoriz|kilometer|license ` in UI copy.
- [ ] Money as `A$1,234.00` with "inc. GST" where a total is shown; dates `DD/MM/YYYY`.
- [ ] Rego rendered in plate style with state (`1HBC 429 · WA`).

## F. Payments (post-1 Oct 2026)

- [ ] No surcharge line, toggle or "+x% card fee" copy anywhere. `surcharge_cents` is 0.
- [ ] PayTo is the first, visually primary option and states the A$3.50 capped workshop fee.
- [ ] Card / Apple Pay / Google Pay labelled "No surcharge".
- [ ] BNPL appears only when the owner toggle is on and the amount ≥ threshold; otherwise it is
      hidden or explained as unavailable. Never pre-selected.

## G. Data, privacy & adapters

- [ ] Sale Pack hides owner name, address, phone, email and payment details; keeps VIN/rego/history.
- [ ] Adapter Inspector shows each port as MOCK or LIVE; no vendor SDK imported outside `src/adapters/live/`.
- [ ] No external image URLs (`grep -r "https://" src/components` shows none for images).
- [ ] No console errors or hydration warnings on load of `/`, `/counter`, `/bay`.

## Report format

```
QA au-auto-prototype-qa — <date> — <surfaces>
A Mobile: PASS | B Bay: PASS | C ACL: PASS | D AAAA: PASS | E Licence/L10n: PASS | F Payments: PASS | G Data: PASS
Notes: …
```
