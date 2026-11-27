// Writes src/generated/licenses.json: every production dependency with its licence, for the
// "Acerca de" page. Runs on postinstall and prebuild so the list never goes stale.
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "src", "generated", "licenses.json");

let raw = "{}";
try {
  const args = ["licenses", "list", "--prod", "--json"];
  const opts = { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] };
  // Under "pnpm run …", npm_execpath points at pnpm's own JS: run it with node (no shell).
  const pnpmJs = process.env.npm_execpath;
  raw =
    pnpmJs && /pnpm/i.test(pnpmJs)
      ? execFileSync(process.execPath, [pnpmJs, ...args], opts)
      : execFileSync(process.platform === "win32" ? "pnpm.cmd" : "pnpm", args, {
          ...opts,
          shell: process.platform === "win32",
        });
} catch (err) {
  console.warn("[build-licenses] pnpm licenses failed; writing an empty list:", err.message);
}

const byLicense = JSON.parse(raw || "{}");
const list = Object.values(byLicense)
  .flat()
  .map((p) => ({
    name: p.name,
    version: p.versions?.[0] ?? "",
    license: p.license,
    homepage: typeof p.homepage === "string" && /^https?:\/\//.test(p.homepage) ? p.homepage : null,
  }))
  // Platform-specific optional binaries add noise and differ per machine.
  .filter(
    (p) => !/^@(img|next\/swc|esbuild)-/.test(p.name) && !/^@img\/sharp-(?!libvips)/.test(p.name),
  )
  .sort((a, b) => a.name.localeCompare(b.name));

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(list, null, 1) + "\n");
console.log(`[build-licenses] ${list.length} dependencias de producción`);
