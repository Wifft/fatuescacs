// Builds public/openings.json from lichess-org/chess-openings (CC0).
// Run by hand when the dataset changes:  pnpm openings:build
// The output is committed, so builds and tests never touch the network.
//
// Format: { source, positions: { [epd]: [eco, name] | 0 } }
//   - [eco, name]: a named opening position;
//   - 0: an intermediate position of some named line (still "book").
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { Chess } from "chess.js";
import { toEpd } from "../src/lib/chess/openings";

const BASE = "https://raw.githubusercontent.com/lichess-org/chess-openings/master";
const FILES = ["a", "b", "c", "d", "e"];

const positions: Record<string, [string, string] | 0> = {};
let lines = 0;

for (const f of FILES) {
  const res = await fetch(`${BASE}/${f}.tsv`, {
    headers: { "User-Agent": "fatuescacs build-openings" },
  });
  if (!res.ok) throw new Error(`${f}.tsv: HTTP ${res.status}`);
  const rows = (await res.text()).split("\n").slice(1).filter(Boolean);
  for (const row of rows) {
    const [eco, name, pgn] = row.split("\t");
    if (!eco || !name || !pgn) continue;
    const g = new Chess();
    g.loadPgn(pgn);
    const history = g.history({ verbose: true });
    history.forEach((m, i) => {
      const epd = toEpd(m.after);
      if (i === history.length - 1) positions[epd] = [eco, name];
      else if (!(epd in positions)) positions[epd] = 0;
    });
    lines++;
  }
}

const out = join(import.meta.dirname, "..", "public", "openings.json");
writeFileSync(
  out,
  JSON.stringify({
    source: "lichess-org/chess-openings (CC0-1.0)",
    positions,
  }),
);
const named = Object.values(positions).filter((v) => v !== 0).length;
console.log(`${lines} líneas → ${Object.keys(positions).length} posiciones (${named} con nombre)`);
