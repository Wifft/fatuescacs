// Records engine evaluations for the golden tests (tests/golden/games/*.pgn → evals/*.json).
// The golden tests never run the engine: they classify these recorded evaluations.
//
//   pnpm golden:record              re-record every game (slow, runs Stockfish in Node)
//   pnpm golden:record opera        only games whose file name contains "opera"
//   pnpm golden:expected            rewrite expected/*.json from the recorded evals
//
// Review the diff of expected/*.json by hand before committing it.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { parsePgn } from "../src/lib/chess/pgn";
import { buildReport } from "../src/lib/chess/report";
import { analyzeGame } from "../src/lib/engine/analyzer";
import { Engine, type EngineTransport } from "../src/lib/engine/engine";
import type { PositionEval } from "../src/lib/engine/uci";

export const GOLDEN_DEPTH = 16;
const ROOT = join(import.meta.dirname, "..", "tests", "golden");
const GAMES = join(ROOT, "games");
const EVALS = join(ROOT, "evals");
const EXPECTED = join(ROOT, "expected");

interface NodeStockfish {
  processCommand(cmd: string): void;
  terminate(): void;
  listener?: (line: string) => void;
}

function nodeTransport(): EngineTransport {
  const require = createRequire(import.meta.url);
  const init = require("stockfish") as (
    kind: string,
    onMessage?: (l: string) => void,
  ) => NodeStockfish;
  let listener: (line: string) => void = () => {};
  const sf = init("lite-single", (line) => listener(line));
  return {
    post: (c) => sf.processCommand(c),
    onLine: (l) => {
      listener = l;
    },
    terminate: () => sf.terminate(),
  };
}

function waitUciOk(t: EngineTransport): Promise<string> {
  return new Promise((resolve) => {
    let name = "";
    t.onLine((line) => {
      const m = /^id name (.+)$/.exec(line.trim());
      if (m?.[1]) name = m[1];
      if (line.trim() === "uciok") resolve(name);
    });
    t.post("uci");
  });
}

const stripNps = ({ score, best, pv, depth }: PositionEval): PositionEval => ({
  score,
  best,
  pv,
  depth,
});

async function record(filter: string | undefined) {
  mkdirSync(EVALS, { recursive: true });
  const transport = nodeTransport();
  const engineName = await waitUciOk(transport);
  const engine = new Engine(transport);
  await engine.configure();

  for (const file of readdirSync(GAMES).filter((f) => f.endsWith(".pgn"))) {
    const name = file.replace(/\.pgn$/, "");
    if (filter && !name.includes(filter)) continue;
    const game = parsePgn(readFileSync(join(GAMES, file), "utf8"));
    const evals: PositionEval[] = new Array(game.fens.length);
    const t0 = performance.now();
    await analyzeGame({
      engine,
      fens: game.fens,
      depth: GOLDEN_DEPTH,
      quickPass: false,
      onEval: (i, e) => {
        evals[i] = stripNps(e);
      },
    });
    writeFileSync(
      join(EVALS, `${name}.json`),
      JSON.stringify({ engine: engineName, depth: GOLDEN_DEPTH, fens: game.fens, evals }, null, 1) +
        "\n",
    );
    console.log(
      `${name}: ${game.fens.length} posiciones en ${((performance.now() - t0) / 1000).toFixed(1)} s`,
    );
  }
  engine.terminate();
}

function writeExpected(filter: string | undefined) {
  mkdirSync(EXPECTED, { recursive: true });
  for (const file of readdirSync(EVALS).filter((f) => f.endsWith(".json"))) {
    const name = file.replace(/\.json$/, "");
    if (filter && !name.includes(filter)) continue;
    const game = parsePgn(readFileSync(join(GAMES, `${name}.pgn`), "utf8"));
    const { evals } = JSON.parse(readFileSync(join(EVALS, file), "utf8")) as {
      evals: PositionEval[];
    };
    const report = buildReport(game.moves, game.legalMoves, evals);
    const moves = game.moves.map((m, i) => {
      const c = report.classes[i];
      return `${m.moveNumber}${m.color === "w" ? "." : "..."} ${m.san} ${c?.cls ?? "?"} ${c ? c.loss.toFixed(1) : ""}`.trim();
    });
    const round = (x: number | null | undefined) => (x == null ? null : Math.round(x * 10) / 10);
    writeFileSync(
      join(EXPECTED, `${name}.json`),
      JSON.stringify(
        { moves, accuracy: { w: round(report.accuracy?.w), b: round(report.accuracy?.b) } },
        null,
        2,
      ) + "\n",
    );
    console.log(`${name}: expected escrito`);
  }
}

const [mode, filter] = process.argv.slice(2);
if (mode === "expected") writeExpected(filter);
else await record(mode === "record" ? filter : mode);
