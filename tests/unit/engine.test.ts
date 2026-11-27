import { describe, expect, it } from "vitest";
import { analyzeGame, EvalCache } from "@/lib/engine/analyzer";
import {
  Engine,
  isAbortError,
  type AnalysisEngine,
  type EngineTransport,
} from "@/lib/engine/engine";
import type { PositionEval } from "@/lib/engine/uci";

/** Fake UCI engine: answers `go` asynchronously and counts concurrent searches. */
class FakeTransport implements EngineTransport {
  sent: string[] = [];
  running = 0;
  maxRunning = 0;
  private listener: (line: string) => void = () => {};
  private pending: ReturnType<typeof setTimeout> | null = null;

  post(c: string) {
    this.sent.push(c);
    if (c === "isready") queueMicrotask(() => this.listener("readyok"));
    if (c.startsWith("go")) {
      this.running++;
      this.maxRunning = Math.max(this.maxRunning, this.running);
      this.pending = setTimeout(() => this.finish("cp 25"), 5);
    }
    if (c === "stop" && this.pending) {
      clearTimeout(this.pending);
      queueMicrotask(() => this.finish("cp 1"));
    }
  }
  private finish(score: string) {
    this.pending = null;
    this.running--;
    this.listener(`info depth 8 multipv 1 score ${score} nps 1000 pv e2e4 e7e5`);
    this.listener("bestmove e2e4 ponder e7e5");
  }
  onLine(l: (line: string) => void) {
    this.listener = l;
  }
  terminate() {}
}

const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const AFTER_E4 = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1";

describe("Engine", () => {
  it("serialises searches: never two `go` at once", async () => {
    const t = new FakeTransport();
    const e = new Engine(t);
    await e.configure();
    const results = await Promise.all([
      e.analyse(START, 8),
      e.analyse(AFTER_E4, 8),
      e.analyse(START, 8),
    ]);
    expect(t.maxRunning).toBe(1);
    expect(results[0]?.score).toEqual({ kind: "cp", cp: 25 });
    // Black to move: score flipped to white's point of view.
    expect(results[1]?.score).toEqual({ kind: "cp", cp: -25 });
    expect(t.sent).toContain("setoption name Hash value 32");
    expect(t.sent).toContain("setoption name MultiPV value 1");
  });

  it("cancels: sends stop, waits for bestmove and rejects with AbortError", async () => {
    const t = new FakeTransport();
    const e = new Engine(t);
    const ctrl = new AbortController();
    const p = e.analyse(START, 30, ctrl.signal);
    await new Promise((r) => setTimeout(r, 0));
    ctrl.abort();
    const err = await p.catch((x: unknown) => x);
    expect(isAbortError(err)).toBe(true);
    expect(t.sent).toContain("stop");
    // The queue keeps working after a cancellation.
    const next = await e.analyse(START, 8);
    expect(next.best).toBe("e2e4");
  });

  it("rejects immediately when the signal is already aborted", async () => {
    const t = new FakeTransport();
    const e = new Engine(t);
    const ctrl = new AbortController();
    ctrl.abort();
    await expect(e.analyse(START, 8, ctrl.signal)).rejects.toMatchObject({ name: "AbortError" });
    expect(t.sent.some((c) => c.startsWith("go"))).toBe(false);
  });
});

class CountingEngine implements AnalysisEngine {
  calls: [string, number][] = [];
  newGames = 0;
  async newGame() {
    this.newGames++;
  }
  async analyse(fen: string, depth: number): Promise<PositionEval> {
    this.calls.push([fen, depth]);
    return { score: { kind: "cp", cp: depth }, best: "e2e4", pv: ["e2e4"], depth, nps: 100 };
  }
}

describe("analyzeGame", () => {
  const MATED = "rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3";

  it("does a quick pass then the requested depth, and skips terminal positions", async () => {
    const engine = new CountingEngine();
    const seen: [number, number, string][] = [];
    const progress: string[] = [];
    const m = await analyzeGame({
      engine,
      fens: [START, AFTER_E4, MATED],
      depth: 16,
      onEval: (i, e, phase) => seen.push([i, e.depth, phase]),
      onProgress: (p) => progress.push(`${p.phase}:${p.done}/${p.total}`),
    });
    expect(engine.newGames).toBe(1);
    expect(engine.calls).toEqual([
      [START, 10],
      [AFTER_E4, 10],
      [START, 16],
      [AFTER_E4, 16],
    ]);
    expect(seen.filter(([, , ph]) => ph === "full").map(([i]) => i)).toEqual([0, 1, 2]);
    expect(progress.at(-1)).toBe("done:3/3");
    expect(m.avgNps).toBe(100);
  });

  it("only one pass when depth ≤ 10", async () => {
    const engine = new CountingEngine();
    await analyzeGame({ engine, fens: [START], depth: 8 });
    expect(engine.calls).toEqual([[START, 8]]);
  });

  it("uses the FEN + depth cache", async () => {
    const engine = new CountingEngine();
    const cache = new EvalCache();
    await analyzeGame({ engine, fens: [START, AFTER_E4], depth: 12, cache });
    const m = await analyzeGame({ engine, fens: [START, AFTER_E4], depth: 12, cache });
    expect(engine.calls).toHaveLength(4);
    expect(m.cacheHits).toBe(2);
  });

  it("reuses cached final-depth evaluations in the quick pass (reopening a saved analysis)", async () => {
    const engine = new CountingEngine();
    const cache = new EvalCache();
    const saved = { score: { kind: "cp", cp: 7 }, best: "e2e4", pv: ["e2e4"], depth: 16 } as const;
    cache.set(START, 16, { ...saved, pv: [...saved.pv] });
    cache.set(AFTER_E4, 16, { ...saved, pv: [...saved.pv] });
    await analyzeGame({ engine, fens: [START, AFTER_E4], depth: 16, cache });
    expect(engine.calls).toEqual([]);
  });

  it("stops when aborted", async () => {
    const engine = new CountingEngine();
    const ctrl = new AbortController();
    const p = analyzeGame({
      engine,
      fens: [START, AFTER_E4, START],
      depth: 12,
      signal: ctrl.signal,
      onEval: () => ctrl.abort(),
    });
    await expect(p).rejects.toMatchObject({ name: "AbortError" });
    expect(engine.calls).toHaveLength(1);
  });
});
