# DESIGN.md — MyGarage visual system

**Direction:** modern-industrial editorial automotive. Think of a well-run regional workshop: swept
concrete floor, steel benches, a charcoal toolboard, job tags clipped to keys. On top of that,
the clarity of a Swiss service manual. Quiet surfaces, exact numbers, and one loud colour system:
the traffic-light status that tells a driver what matters.

The design has to look trustworthy enough that a husband-and-wife shop in Bunbury would put their
name on it, and plain enough that a driver understands it in five seconds in a car park.

---

## 1. Tokens

### Colour

| Token | Hex | Name | Use |
|---|---|---|---|
| `--stone` | `#E6E3DC` | Shop-floor stone | Page background (customer & counter) |
| `--bench` | `#F8F7F4` | Bench | Raised surfaces: panels, sheets, drawers |
| `--sump` | `#1F2428` | Sump | Ink, primary buttons, section rules |
| `--slate` | `#4D5660` | Slate | Secondary text, icons |
| `--chalk` | `#CFCAC0` | Chalk line | 1px rules, input borders, dividers |
| `--brand` | `#1D4F66` | Leschenault (tenant) | Workshop brand band, Wallet pass. **Per-workshop**, read from `workshops.brand_primary` |

Status (the only saturated colours in the product — nothing decorative may use them):

| Token | Hex | Tint (`-wash`) | Meaning | Ink on fill |
|---|---|---|---|---|
| `--red` | `#C42F1C` (brake light) | `#F6E1DC` | Urgent / safety attention | white |
| `--amber` | `#E08900` (indicator) | `#FAEDD5` | Ones to watch / upcoming | `--sump` (never white) |
| `--green` | `#2C7A4B` (pass) | `#DFEEE4` | Checked & healthy | white |

Bay mode (sunlit, AAA contrast): `--bay-paper #FFFFFF`, `--bay-ink #000000`, 3px black borders,
status fills at full strength with white/black ink only.

### Type

Two families, clearly distinct, self-hosted with `next/font/local` (no network at build):

- **Archivo** (variable: `wght` 100–900, `wdth` 62–125) — the voice.
  - *Tailgate* display: `wdth 125`, `wght 800`, tracking `-0.02em`, line-height 0.95. Used for
    vehicle model names (`HILUX SR5`), the garage title, the counter's big numbers. Uppercase is
    allowed **only** here, because it is how model names are badged on the vehicles themselves.
  - Text: `wdth 100`, `wght 400/500/600`, line-height 1.5, sentence case.
  - Compact: `wdth 80`, `wght 600` for dense table headers and badges in the counter console.
- **Martian Mono** (variable: `wght` 100–800, `wdth` 75–112.5) — the instruments. Readouts only:
  rego plates, odometers, A$ amounts, VINs, quote/invoice numbers, timestamps, hashes, mm
  measurements. Never for labels or prose. `wdth 87.5` in tables, `100` in plates.

Scale (16px base, ~1.25 ratio): `12 · 13 · 14 · 16 · 18 · 20 · 24 · 30 · 38 · 48 · 60`.
Body measure ≤ 70ch. Labels are sentence case, no letter-spaced caps eyebrows.

### Space, shape, depth

- 8px base unit; 4px for tight internal gaps.
- Grid: mobile 4 columns, 16px margins, 12px gutters. Desktop (≥1024px) 12 columns, 24px
  gutters, max 1280px. Content is **left-aligned**; nothing important is centred except modals.
- Radius by role, not one radius for everything: controls 6px · plates 6px (with inset rule) ·
  tags 2px · sheets/drawers 12px top corners · pills never.
- Depth comes from borders and surface colour (`--stone` → `--bench`), not shadows. One shadow
  exists: drawers/modals, `0 12px 40px rgb(31 36 40 / 0.18)`.

---

## 2. Signature devices (the things that make it ours)

1. **Tailgate badging.** Each vehicle's model name is set huge in Archivo Expanded 800, the
   way it is pressed into a HiLux tailgate. This is the one bold element; everything around it
   stays quiet.
2. **The plate.** Regos render as a plate: white field, 2px sump border, inset 1px rule, Martian
   Mono 600 with a small state code (`WA`). It's the customer's own identifier, so it leads every card.
3. **Job tags, not cards.** Findings are tags with a 6px status edge on the left (red/amber/green),
   like the coloured job tags clipped to keys at the counter. Red tags are taller and come first.
4. **Dashed = indicative, solid = binding.** An ACL estimate is always drawn with a 1.5px
   **dashed** border plus the `ACL_ESTIMATE_LABEL` badge. A Fixed Quote is drawn with a solid
   border and a **double rule** top and bottom (like a printed tax invoice) plus quote number,
   GST line and validity date. The legal difference is visible before anyone reads a word.
5. **Wear gauges.** Inspection diagrams are line drawings (2px sump strokes) where only the fault
   zone takes status colour, with the measurement called out in Martian Mono (`2 mm`, `11.9 V`).

---

## 3. Layout concepts

### Customer Living Garage (390 × 844 first)

```
┌──────────────────────────────┐
│ ▓ South West Mechanical & 4x4│  brand band (--brand), WA licence MRB8421
│   WA Repairer Licence MRB8421│
├──────────────────────────────┤
│ Your garage · Hartley family │  ← sentence case title
│ ┌────────┐┌────────┐┌──────  │  horizontal vehicle switcher (snap)
│ │[1HBC429]││[1GYT812]││[1FTR │  plate + model + km + health dot
│ │HILUX   ││CX-5    ││RANG    │
│ └────────┘└────────┘└──────  │
├──────────────────────────────┤
│ HILUX SR5                    │  tailgate display, 48px
│ 2021 · 84,200 km · rego 41d  │
│ [Wallet sticker] [Message]   │
├──────────────────────────────┤
│ ▌Urgent (1)                  │  red tag, taller, diagram + quote
│ ▌Ones to watch (2)           │  amber tags, dashed estimate box
│ ▸ Checked & healthy (14)     │  collapsed
├──────────────────────────────┤
│ Service history  · Sale pack │
│ Book a service · Mod quote   │
└──────────────────────────────┘
  sticky bottom bar: Book · Messages · Wallet
```

Desktop (≥1024px): vehicle rail on the left (3 cols), roadmap centre (6 cols), timeline and
actions right (3 cols).

### Front-Counter console (1440 × 900)

```
┌────────┬─────────────────────────────────────────────┐
│ Shop   │ Today · A$ recoverable on the table: 14,380 │
│ nav    ├───────────────────────┬─────────────────────┤
│ Bridge │ PDF Bridge            │ Review gate (10 s)  │
│ Rainy  │ [drop PDF] [sample]   │ parsed fields ✓     │
│ Inbox  │ ▒▒ scan animation ▒▒  │ [Approve & publish] │
│ Vault  ├───────────────────────┴─────────────────────┤
│ DVI    │ Rainy-day pipeline table (rank · value · age)│
│ Setup  │ [Fill quiet Tuesday bay]                     │
└────────┴─────────────────────────────────────────────┘
```

### Technician bay (tablet 1024 × 768, phone 390 × 844)

```
┌──────────────────────────────────────────┐
│ BAY 2 · HILUX 1HBC 429         [Change]  │  black on white, 3px rules
├──────────────────────────────────────────┤
│ ┌──────────────────────────────────────┐ │
│ │       HOLD TO DICTATE FINDING        │ │  ≥ 120px tall, full width
│ └──────────────────────────────────────┘ │
│ transcript → plain-English finding       │
│ [ RED ] [ AMBER ] [ GREEN ]  (64px each) │
│ estimate A$400–A$450   [Save for review] │
└──────────────────────────────────────────┘
```

---

## 4. Components (contract)

- **Button** — primary: `--sump` fill, white text, 48px min height (44px customer minimum);
  secondary: 1.5px `--sump` outline; quiet: text + underline on hover. Labels say exactly what
  happens ("Approve fixed quote", "Publish to garage"). No trailing arrows.
- **StatusBadge** — shape + word, never colour alone: Red = filled square with `!`,
  Amber = gauge icon, Green = tick. Text: "Urgent", "Watch", "Healthy".
- **EstimateBox** — dashed border, range in Martian Mono (`A$420 – A$480`), "inc. GST", and the
  ACL badge on its own line.
- **FixedQuote** — solid border, double rules, line items (part / labour `1.5 h × A$165.00`),
  subtotal, GST, total, "Valid until 12/12/2026", issuer + licence.
- **Plate** (`<Rego>`), **LicenceTag**, **Drawer** (bottom sheet on mobile, right panel on
  desktop), **Modal** (AAAA refusal, signature), **SignaturePad** (canvas, 2px sump ink).

## 5. Motion

Two orchestrated moments only, both answering a person's action:
1. **PDF Bridge scan** — a scan line sweeps the invoice preview while extraction steps tick
   through (OCR → layout → field extraction → validation), ~2.4s total.
2. **Wallet pass flip** — 3D flip front ↔ back (400ms).

Everything else: 120–160ms opacity/transform on open/close. `prefers-reduced-motion` removes the
sweep and flip (cross-fade instead).

## 6. Copy voice

Plain Australian English, sentence case, workshop-honest, no hype. Say what the part does and
what happens next: "Your front brake pads are down to 2 mm. Book them in before you drive much
further." Errors say what happened and how to fix it. Money always carries "inc. GST".

## 7. Accessibility floor

WCAG 2.2 AA on customer and counter surfaces, AAA text contrast in bay mode. 3px focus ring in
`--brand` with 2px offset. Visible keyboard paths for hold-to-dictate (Space) and signature
alternatives (typed name is required anyway). All diagrams carry `role="img"` + `aria-label`.

## 8. Review notes (first instinct → revised)

- Page colour started as a cream (`#F4F1EA`), a generic "warm editorial" default. Moved to a greyer
  shop-floor stone `#E6E3DC` so it reads workshop, not stationery.
- No terracotta/clay accent. The only accent is the tenant's brand band, so each workshop looks
  like itself, and status colours stay unambiguous.
- Monospace was going to label things; restricted it to real readouts so numbers feel like
  instruments and labels stay human.
- Dropped letter-spaced uppercase eyebrows and numbered section markers (the content isn't a sequence).
- Replaced a uniform rounded-card grid with job tags (status edge) and role-based radii.

## 9. Don'ts

Purple/blue gradients · glassmorphism · drop shadows on every card · emoji as icons · stock photos
or external image URLs · status colours used decoratively · centred body copy · "Submit" buttons ·
estimates shown without the ACL badge · any surcharge line.
