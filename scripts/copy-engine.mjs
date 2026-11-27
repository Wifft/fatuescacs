// Copia la build de Stockfish que sirve la app desde node_modules/stockfish/bin a public/engine.
// Se ejecuta en postinstall. Falla si falta algún fichero para no arrancar con un motor roto.
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const FILES = [
  "stockfish-19-lite-single.js",
  "stockfish-19-lite-single.wasm",
  "stockfish-19-asm.js",
];

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(join(root, "package.json"));

let binDir;
try {
  binDir = join(dirname(require.resolve("stockfish/package.json")), "bin");
} catch {
  console.error("[copy-engine] No encuentro el paquete 'stockfish'. ¿Has ejecutado pnpm install?");
  process.exit(1);
}

const outDir = join(root, "public", "engine");
mkdirSync(outDir, { recursive: true });

const missing = FILES.filter((f) => !existsSync(join(binDir, f)));
if (missing.length > 0) {
  console.error(`[copy-engine] Faltan ficheros en ${binDir}: ${missing.join(", ")}`);
  process.exit(1);
}

for (const f of FILES) copyFileSync(join(binDir, f), join(outDir, f));
console.log(`[copy-engine] ${FILES.length} ficheros copiados a public/engine/`);
