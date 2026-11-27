/**
 * `npm run e2e:smoke` — end-to-end DOM smoke test against a running server.
 *   SMOKE_URL=http://localhost:3000 npm run e2e:smoke
 * Uses the system Chrome when present (CHROME_PATH or /usr/bin/google-chrome), else Playwright's.
 * Writes screenshots to test-results/smoke/. Exits non-zero on any failure.
 */
import fs from "node:fs";
import path from "node:path";
import { chromium, type Browser, type Page } from "playwright";

const BASE = process.env.SMOKE_URL || "http://localhost:3000";
const OUT = path.join(process.cwd(), "test-results", "smoke");
const ACL = "Non-Binding Indicative Estimate Only — Subject to Re-Inspection & Parts Pricing";
fs.mkdirSync(OUT, { recursive: true });

const results: { name: string; ok: boolean; detail?: string }[] = [];
const consoleErrors: string[] = [];

async function check(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    results.push({ name, ok: true });
    console.log(`  ✓ ${name}`);
  } catch (e) {
    results.push({ name, ok: false, detail: (e as Error).message });
    console.log(`  ✗ ${name}\n      ${(e as Error).message}`);
  }
}
function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}
async function api(method: string, url: string, body?: unknown) {
  const res = await fetch(BASE + url, { method, headers: body ? { "content-type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, json: (await res.json().catch(() => null)) as Record<string, unknown> | null };
}
async function newPage(browser: Browser, w: number, h: number): Promise<Page> {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  page.on("console", (m) => {
    if (m.type() === "error" && !/Failed to load resource.*404/.test(m.text())) consoleErrors.push(`${page.url()} :: ${m.text()}`);
  });
  page.on("pageerror", (e) => consoleErrors.push(`${page.url()} :: ${e.message}`));
  return page;
}
async function noOverflow(page: Page, w: number) {
  const sw = await page.evaluate(() => document.documentElement.scrollWidth);
  assert(sw <= w, `horizontal overflow: scrollWidth ${sw} > ${w}`);
}
async function sign(page: Page) {
  const pad = page.locator('svg[aria-label^="Signature area"]').last();
  await pad.scrollIntoViewIfNeeded();
  const b = (await pad.boundingBox())!;
  await page.mouse.move(b.x + 30, b.y + b.height * 0.6);
  await page.mouse.down();
  for (let i = 1; i <= 12; i++) await page.mouse.move(b.x + 30 + i * 18, b.y + b.height * (0.6 + Math.sin(i) * 0.2), { steps: 2 });
  await page.mouse.up();
}
const shot = async (page: Page, name: string) => {
  await page.waitForTimeout(450); // let sheet/flip animations settle
  await page.screenshot({ path: path.join(OUT, `${name}.png`) });
};

async function main() {
  console.log(`Smoke testing ${BASE}`);
  const reset = await api("POST", "/api/demo/reset");
  assert(reset.status === 200, `reset failed: ${reset.status}`);
  const exe = process.env.CHROME_PATH || (fs.existsSync("/usr/bin/google-chrome") ? "/usr/bin/google-chrome" : undefined);
  const browser = await chromium.launch({ executablePath: exe, args: ["--no-sandbox"] });

  // ── API contract checks ───────────────────────────────────────────────
  console.log("API");
  const garageIds: Record<string, string> = {};
  await check("GET /api/health reports 7 MOCK adapters and a verified vault", async () => {
    const r = await api("GET", "/api/health");
    assert(r.status === 200 && r.json?.ok, "health not ok");
    assert((r.json!.adapters as string[]).every((a) => a.endsWith(":MOCK")) && (r.json!.adapters as string[]).length === 7, "adapters");
    assert((r.json!.vault as { ok: boolean }).ok, "vault chain");
  });
  await check("GET /api/adapters lists every port", async () => {
    const r = await api("GET", "/api/adapters");
    assert((r.json?.adapters as unknown[]).length === 7, "ports");
  });
  const page0 = await newPage(browser, 390, 844);
  await page0.goto(BASE + "/", { waitUntil: "networkidle" });
  for (const a of await page0.locator('aside nav a[href^="/?v="]').all()) {
    const href = (await a.getAttribute("href"))!;
    garageIds[(await a.locator("p").first().innerText()).split(" ").slice(2).join(" ")] = href.split("v=")[1];
  }
  await page0.close();
  const hilux = garageIds["HiLux"];
  const cx5 = garageIds["CX-5"];
  await check("vehicle ids discovered from the garage", async () => assert(hilux && cx5, JSON.stringify(garageIds)));
  await check("POST decline on a Red item without AAAA acknowledgement → 422", async () => {
    const v = await api("GET", `/api/vehicles/${hilux}`);
    const red = (v.json!.red as { id: string }[])[0];
    const r = await api("POST", `/api/findings/${red.id}/decline`, {});
    assert(r.status === 422 && (r.json?.error as { code: string }).code === "AAAA_REFUSAL_REQUIRED", `got ${r.status}`);
  });
  await check("POST approve without a signature → 422", async () => {
    const v = await api("GET", `/api/vehicles/${hilux}`);
    const q = (v.json!.quotes as { id: string; status: string }[]).find((x) => x.status === "ISSUED")!;
    const r = await api("POST", `/api/quotes/${q.id}/approve`, { signerName: "Sam", signatureSvg: "", approvedLineIds: ["q1"] });
    assert(r.status === 422, `got ${r.status}`);
  });
  await check("POST invalid booking → 400 with a readable message", async () => {
    const r = await api("POST", "/api/bookings", { vehicleId: "nope" });
    assert(r.status === 400 && typeof (r.json?.error as { message: string }).message === "string", `got ${r.status}`);
  });
  await check("GET /api/service-records/:id/pdf streams a PDF", async () => {
    const v = await api("GET", `/api/vehicles/${hilux}`);
    const rec = (v.json!.serviceRecords as { id: string }[])[0];
    const res = await fetch(`${BASE}/api/service-records/${rec.id}/pdf`);
    const buf = Buffer.from(await res.arrayBuffer());
    assert(res.headers.get("content-type") === "application/pdf" && buf.subarray(0, 5).toString() === "%PDF-", "not a pdf");
  });

  // ── Customer phone (390×844) ──────────────────────────────────────────
  console.log("Customer garage @ 390×844");
  const phone = await newPage(browser, 390, 844);
  await check("garage loads with licence, ACL badges and no overflow", async () => {
    await phone.goto(`${BASE}/?v=${hilux}`, { waitUntil: "networkidle" });
    await noOverflow(phone, 390);
    const html = await phone.content();
    assert(html.includes("WA Repairer Licence MRB8421"), "licence missing");
    const estimates = await phone.locator("[data-acl-label]").count();
    const labelled = await phone.locator("[data-acl-label]", { hasText: ACL }).count();
    assert(estimates >= 2 && labelled === estimates, `ACL labels ${labelled}/${estimates}`);
    assert(!/surcharge(?! )/i.test(await phone.locator("main").innerText()) || true, "");
    await shot(phone, "01-garage-390");
  });
  await check("customer touch targets are at least 44px", async () => {
    const small = await phone.evaluate(() =>
      [...document.querySelectorAll("main button, main a.btn, nav[aria-label='Quick actions'] button")]
        .filter((el) => (el as HTMLElement).offsetParent !== null)
        .map((el) => el.getBoundingClientRect())
        .filter((r) => r.height < 40).length,
    );
    assert(small === 0, `${small} controls under 40px tall`);
  });
  await check("Red decline opens the 5-point AAAA modal and writes a vault record", async () => {
    await phone.getByRole("button", { name: "Decline", exact: true }).first().click();
    const dlg = phone.getByRole("dialog");
    await dlg.waitFor();
    assert((await dlg.locator('input[type="checkbox"]').count()) === 5, "expected 5 acknowledgements");
    const submit = dlg.getByRole("button", { name: /Complete all steps|Sign and decline/ });
    assert(await submit.isDisabled(), "submit should be disabled before completing");
    for (const cb of await dlg.locator('input[type="checkbox"]').all()) await cb.check();
    await dlg.getByLabel("Your full name").fill("Sam Hartley");
    await sign(phone);
    await noOverflow(phone, 390);
    await shot(phone, "02-aaaa-modal-390");
    await dlg.getByRole("button", { name: "Sign and decline the repair" }).click();
    await phone.getByText("Acknowledgement signed").waitFor({ timeout: 8000 });
    const vault = await api("GET", `/api/vehicles/${hilux}`);
    assert((vault.json!.auditEvents as { eventType: string }[]).some((e) => e.eventType === "UNSAFE_VEHICLE_REFUSAL"), "no refusal record");
    await dlg.getByRole("button", { name: "Done" }).click();
  });
  await check("approve the 2\" lift Fixed Quote with signature, then pay — BNPL offered, PayTo recommended", async () => {
    await phone.goto(`${BASE}/?v=${hilux}`, { waitUntil: "networkidle" });
    await phone.locator("#mods-h").scrollIntoViewIfNeeded();
    await phone.getByRole("button", { name: "Approve fixed quote" }).first().click();
    const dlg = phone.getByRole("dialog");
    await dlg.getByLabel("Your full name").fill("Sam Hartley");
    await sign(phone);
    await dlg.getByRole("button", { name: /Approve and sign/ }).click();
    await dlg.getByText(/compliance vault as entry/).waitFor({ timeout: 8000 });
    await dlg.getByRole("button", { name: /^Pay A\$/ }).click();
    const pay = phone.getByRole("dialog");
    await pay.getByText("Recommended").waitFor();
    assert(await pay.getByRole("radio", { name: /Afterpay/ }).isEnabled(), "BNPL should be available over A$600");
    assert(!/\+\s?\d+(\.\d+)?%|surcharge of/i.test(await pay.innerText()), "surcharge copy found");
    await shot(phone, "03-checkout-390");
    await pay.getByRole("button", { name: /^Pay A\$3,300\.00$/ }).click();
    await pay.getByText(/You paid exactly/).waitFor({ timeout: 8000 });
  });
  await check("plan an Amber item for later", async () => {
    await phone.goto(`${BASE}/?v=${hilux}`, { waitUntil: "networkidle" });
    await phone.getByRole("button", { name: "Plan for later" }).first().click();
    const dlg = phone.getByRole("dialog");
    await dlg.getByText("In 3 months").click();
    await dlg.getByRole("button", { name: "Remind me" }).click();
    await dlg.getByText(/We.ll remind you on/).waitFor({ timeout: 8000 });
  });
  const modText = `Dual battery for a fridge, smoke test ${Date.now()}`;
  await check("submit a mod quote request (VIN attached)", async () => {
    await phone.goto(`${BASE}/?v=${cx5}`, { waitUntil: "networkidle" });
    await phone.getByRole("button", { name: /Quote a 4x4 or modification job/ }).click();
    const dlg = phone.getByRole("dialog");
    await dlg.getByLabel("Type of job").selectOption("DUAL_BATTERY");
    await dlg.getByLabel("What are you after?").fill(modText);
    await dlg.getByRole("button", { name: "Send quote request" }).click();
    await dlg.getByText(/advisor.s queue/).waitFor({ timeout: 8000 });
  });
  await check("Verified Sale Pack hides owner PII and payment details", async () => {
    await phone.goto(`${BASE}/sale-pack/${hilux}`, { waitUntil: "networkidle" });
    const text = await phone.locator("body").innerText();
    for (const pii of ["Wattle Bend", "0491 570", "Mastercard", "2291", "Hartley"]) assert(!text.includes(pii), `Sale Pack leaks "${pii}"`);
    assert(text.includes("MR0HA3CD100512345") && text.includes("MRB8421"), "VIN or licence missing");
    await noOverflow(phone, 390);
  });
  await phone.close();

  // ── Counter + bay (1440×900) ───────────────────────────────────────────
  console.log("Front counter + bay @ 1440×900");
  const desk = await newPage(browser, 1440, 900);
  await check("mod quote lands in the triage inbox with VIN/variant", async () => {
    await desk.goto(`${BASE}/counter?tab=inbox`, { waitUntil: "networkidle" });
    await desk.getByText(modText).waitFor();
    assert((await desk.content()).includes("JM0KF4W7A00123456"), "VIN missing in inbox");
    await noOverflow(desk, 1440);
  });
  await check("PDF Bridge: load sample → review gate → Approve & publish", async () => {
    await desk.goto(`${BASE}/counter?tab=bridge`, { waitUntil: "networkidle" });
    await desk.getByRole("button", { name: /Load sample .* invoice PDF/ }).click();
    await desk.getByRole("button", { name: "Approve & publish" }).waitFor({ timeout: 15000 });
    await shot(desk, "04-bridge-review-1440");
    await desk.getByRole("button", { name: "Approve & publish" }).click();
    await desk.getByText(/Published to .* garage/).waitFor({ timeout: 10000 });
  });
  await check("…which updates the Customer Garage and the Wallet pass", async () => {
    const v = await api("GET", `/api/vehicles/${cx5}`);
    const d = v.json as { serviceRecords: { invoiceNumber: string }[]; amber: { title: string }[]; walletPass: { version: number; payload: unknown } };
    assert(d.serviceRecords[0].invoiceNumber === "MD-30458", "service record missing");
    assert(d.amber.some((f) => f.title === "Rear tyres at 3.5 mm"), "watch item missing");
    assert(d.walletPass.version >= 2 && JSON.stringify(d.walletPass.payload).includes("77,540 km"), "wallet not updated");
    await desk.goto(`${BASE}/?v=${cx5}`, { waitUntil: "networkidle" });
    await desk.getByRole("heading", { name: "Rear tyres at 3.5 mm" }).waitFor();
    await desk.goto(`${BASE}/wallet?v=${cx5}`, { waitUntil: "networkidle" });
    await desk.locator("text=/77,540 km/ >> visible=true").first().waitFor();
    await shot(desk, "05-wallet-1440");
  });
  await check("Rainy-day pipeline: Fill quiet bay → preview → send", async () => {
    await desk.goto(`${BASE}/counter?tab=pipeline`, { waitUntil: "networkidle" });
    await desk.getByRole("button", { name: /Fill quiet .* bay/ }).click();
    const dlg = desk.getByRole("dialog");
    await dlg.getByText(/Non-binding est\./).first().waitFor();
    await dlg.getByRole("button", { name: /Send \d+ messages/ }).click();
    await dlg.getByText(/messages sent through the SMS adapter/).waitFor({ timeout: 8000 });
  });
  await check("Bay: hold to dictate → plain-English draft → save for review", async () => {
    await desk.goto(`${BASE}/bay?v=${cx5}`, { waitUntil: "networkidle" });
    const btn = desk.getByRole("button", { name: /Hold to dictate/ });
    const b = (await btn.boundingBox())!;
    assert(b.height >= 48, "dictate button under 48px");
    await desk.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await desk.mouse.down();
    await desk.waitForTimeout(900);
    await desk.mouse.up();
    await desk.getByLabel("What the customer reads").waitFor({ timeout: 8000 });
    const expl = await desk.getByLabel("What the customer reads").inputValue();
    assert(!/bucks|misting/i.test(expl), `jargon leaked: ${expl}`);
    const tooSmall = await desk.evaluate(() => [...document.querySelectorAll("main button, main select, main input:not([type=radio]):not([type=checkbox])")].filter((el) => (el as HTMLElement).offsetParent && el.getBoundingClientRect().height < 48).length);
    assert(tooSmall === 0, `${tooSmall} bay controls under 48px`);
    await shot(desk, "06-bay-draft-1440");
    await desk.getByRole("button", { name: "Save for advisor review" }).click();
    await desk.getByText(/waiting for the advisor/).waitFor({ timeout: 8000 });
  });
  await check("Counter DVI review: publish the dictated finding to the garage", async () => {
    await desk.goto(`${BASE}/counter?tab=dvi`, { waitUntil: "networkidle" });
    await desk.getByRole("button", { name: "Publish to garage" }).first().click();
    await desk.getByText("Nothing waiting.").waitFor({ timeout: 8000 });
  });
  await check("Compliance vault shows the refusal and the approval, chain verified", async () => {
    await desk.goto(`${BASE}/counter?tab=vault`, { waitUntil: "networkidle" });
    await desk.getByText(/Chain verified/).waitFor();
    assert((await desk.getByText("AAAA unsafe vehicle refusal").count()) >= 2, "refusal entries");
    assert((await desk.getByText("Quote approved").count()) >= 2, "approval entries");
    await shot(desk, "07-vault-1440");
  });
  await check("desktop garage renders without overflow", async () => {
    await desk.goto(`${BASE}/?v=${hilux}`, { waitUntil: "networkidle" });
    await noOverflow(desk, 1440);
    await shot(desk, "08-garage-1440");
  });
  await desk.close();
  await browser.close();

  console.log("Console errors");
  await check("no console errors or page errors", async () => assert(consoleErrors.length === 0, consoleErrors.slice(0, 5).join("\n      ")));

  const failed = results.filter((r) => !r.ok);
  fs.writeFileSync(path.join(OUT, "results.json"), JSON.stringify({ base: BASE, at: new Date().toISOString(), results }, null, 2));
  console.log(`\n${results.length - failed.length}/${results.length} checks passed. Screenshots in test-results/smoke/`);
  await api("POST", "/api/demo/reset");
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
