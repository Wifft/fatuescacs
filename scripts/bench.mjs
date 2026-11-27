// Measures real analysis time in Chromium against a running server.
//   pnpm build && pnpm start         (in another terminal)
//   pnpm bench [baseUrl] [depth] [--hidden]     defaults: http://localhost:3000 16
// Uses the 41-move Byrne–Fischer game (83 positions).
// --hidden opens a real (headed) Chromium window and puts another tab in front, to measure a
// background tab. Headless Chromium always reports "visible", so it can't measure that.
import { chromium } from "@playwright/test";
import { readFileSync } from "node:fs";
import lz from "lz-string";

const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const hiddenMode = process.argv.includes("--hidden");
const base = args[0] ?? "http://localhost:3000";
const depth = args[1] ?? "16";
const pgn = readFileSync(
  new URL("../tests/golden/games/game-of-the-century.pgn", import.meta.url),
  "utf8",
);
const url = `${base}/analysis#${lz.compressToEncodedURIComponent(pgn.trim())}`;

async function run(label, { hidden = false } = {}) {
  const browser = await chromium.launch({ headless: !hidden });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.addInitScript((d) => localStorage.setItem("depth", d), depth);
  const t0 = Date.now();
  await page.goto(url);
  let other;
  if (hidden) {
    other = await ctx.newPage();
    await other.goto("about:blank");
    await other.bringToFront();
  }
  const vis = await page.evaluate(() => document.visibilityState);
  await page.waitForFunction(
    () =>
      document.querySelector('[data-testid="progress-text"]')?.getAttribute("data-phase") ===
      "full",
    null,
    { timeout: 300_000, polling: 100 },
  );
  const quick = Date.now() - t0;
  await page.waitForFunction(
    () =>
      document.querySelector('[data-testid="progress-text"]')?.getAttribute("data-phase") ===
      "done",
    null,
    { timeout: 600_000, polling: 250 },
  );
  const total = Date.now() - t0;
  const diag = await page.$$eval('[data-testid^="diag-"]', (els) =>
    els.map((e) => `${e.dataset.testid.slice(5)}: ${e.textContent}`),
  );
  console.log(
    `${label} (visibilidad: ${vis}) · informe tras pasada rápida: ${(quick / 1000).toFixed(1)} s · completo: ${(total / 1000).toFixed(1)} s`,
  );
  console.log("   " + diag.join(" | "));
  await browser.close();
}

if (hiddenMode)
  await run(`Byrne–Fischer, prof. ${depth}, pestaña en segundo plano`, { hidden: true });
else await run(`Byrne–Fischer, 83 posiciones, prof. ${depth}`);
