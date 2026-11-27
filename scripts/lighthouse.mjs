// Runs Lighthouse (via pnpm dlx, no dependency) 3 times per route against a running server
// and prints the median score per category. Fails if any median is below 90.
//   pnpm build && pnpm start            (in another terminal)
//   pnpm lighthouse [baseUrl]           default http://localhost:3000
import { chromium } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import lz from "lz-string";

const base = process.argv[2] ?? "http://localhost:3000";
const RUNS = 3;
const CATEGORIES = ["performance", "accessibility", "best-practices", "seo"];
const LEGAL =
  '[White "Legall"]\n[Black "Saint Brie"]\n[Result "1-0"]\n\n1. e4 e5 2. Nf3 d6 3. Bc4 Bg4 4. Nc3 g6 5. Nxe5 Bxd1 6. Bxf7+ Ke7 7. Nd5# 1-0';
const routes = {
  "/": "/",
  "/analysis": `/analysis#${lz.compressToEncodedURIComponent(LEGAL)}`,
  "/import": "/import",
};

// Prefer a native browser: Playwright's Chromium is x86-64 and runs emulated on ARM Windows,
// which skews CPU metrics badly (benchmarkIndex ~400). CHROME_PATH wins if set.
const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const chromePath =
  process.env.CHROME_PATH ||
  (process.platform === "win32" && process.arch === "arm64" && existsSync(EDGE)
    ? EDGE
    : chromium.executablePath());
console.log(`Lighthouse con ${chromePath}`);
const dir = mkdtempSync(join(tmpdir(), "lh-"));
const pnpmJs = process.env.npm_execpath;
const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
let failed = false;

for (const [name, path] of Object.entries(routes)) {
  const scores = Object.fromEntries(CATEGORIES.map((c) => [c, []]));
  for (let i = 0; i < RUNS; i++) {
    const out = join(dir, `${name.replace(/\W/g, "_")}-${i}.json`);
    const args = [
      "dlx",
      "lighthouse@12",
      base + path,
      "--quiet",
      "--output=json",
      `--output-path=${out}`,
      `--only-categories=${CATEGORIES.join(",")}`,
      "--chrome-flags=--headless=new --no-sandbox",
    ];
    const env = { ...process.env, CHROME_PATH: chromePath };
    if (pnpmJs && /pnpm/i.test(pnpmJs))
      execFileSync(process.execPath, [pnpmJs, ...args], { env, stdio: "ignore" });
    else execFileSync("pnpm", args, { env, stdio: "ignore", shell: process.platform === "win32" });
    const report = JSON.parse(readFileSync(out, "utf8"));
    for (const c of CATEGORIES)
      scores[c].push(Math.round((report.categories[c]?.score ?? 0) * 100));
    if (i === 0 && name === "/")
      console.log(`benchmarkIndex ${Math.round(report.environment.benchmarkIndex)}`);
  }
  const line = CATEGORIES.map((c) => {
    const m = median(scores[c]);
    if (m < 90) failed = true;
    return `${c} ${m}${m < 90 ? " ✗" : ""}`;
  }).join(" · ");
  console.log(
    `${name.padEnd(10)} ${line}   (runs: ${CATEGORIES.map((c) => scores[c].join("/")).join(" ")})`,
  );
}
process.exit(failed ? 1 : 0);
