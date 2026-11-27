// Orchestrates the analysis of a whole game: quick pass, then the requested depth.
import { terminalScore } from "../chess/eval";
import { AbortError, type AnalysisEngine } from "./engine";
import type { PositionEval } from "./uci";

export const QUICK_DEPTH = 10;

export type AnalysisPhase = "quick" | "full" | "done";

export interface AnalysisProgress {
  done: number;
  total: number;
  phase: AnalysisPhase;
  depth: number;
}

export interface AnalysisMetrics {
  /** Mean nodes per second over engine searches (null if none ran). */
  avgNps: number | null;
  /** Mean wall time per position in the final pass, ms. */
  msPerPosition: number;
  /** Total wall time, ms. */
  totalMs: number;
  /** Positions answered from the cache in the final pass. */
  cacheHits: number;
}

/** Evaluation cache by `FEN + depth`. Implementations may be async (IndexedDB). */
export interface EvalStore {
  get(fen: string, depth: number): Promise<PositionEval | undefined> | PositionEval | undefined;
  set(fen: string, depth: number, e: PositionEval): Promise<void> | void;
}

/** In-memory cache by `FEN + depth`. */
export class EvalCache implements EvalStore {
  private map = new Map<string, PositionEval>();
  private key = (fen: string, depth: number) => `${fen}|${depth}`;
  get(fen: string, depth: number): PositionEval | undefined {
    return this.map.get(this.key(fen, depth));
  }
  set(fen: string, depth: number, e: PositionEval): void {
    this.map.set(this.key(fen, depth), e);
  }
  get size(): number {
    return this.map.size;
  }
}

export interface AnalyzeOptions {
  engine: AnalysisEngine;
  fens: readonly string[];
  depth: number;
  cache?: EvalStore;
  signal?: AbortSignal;
  /** Called every time a position gets a (better) evaluation. */
  onEval?: (index: number, evaluation: PositionEval, phase: Exclude<AnalysisPhase, "done">) => void;
  onProgress?: (p: AnalysisProgress) => void;
  /** Run the quick depth-10 pass first (default true). */
  quickPass?: boolean;
  now?: () => number;
}

/**
 * Analyses every position. Terminal positions are resolved with chess.js, without the engine.
 * Resolves with metrics, or rejects with an AbortError if `signal` aborts.
 */
export async function analyzeGame(opts: AnalyzeOptions): Promise<AnalysisMetrics> {
  const { engine, fens, depth, cache = new EvalCache(), signal, onEval, onProgress } = opts;
  const now = opts.now ?? (() => performance.now());
  const t0 = now();
  const total = fens.length;
  const passes: { phase: "quick" | "full"; depth: number }[] =
    depth > QUICK_DEPTH && opts.quickPass !== false
      ? [
          { phase: "quick", depth: QUICK_DEPTH },
          { phase: "full", depth },
        ]
      : [{ phase: "full", depth }];

  let npsSum = 0;
  let npsN = 0;
  let fullStart = t0;
  let cacheHits = 0;

  await engine.newGame();
  for (const pass of passes) {
    if (pass.phase === "full") fullStart = now();
    for (let i = 0; i < total; i++) {
      if (signal?.aborted) throw new AbortError();
      onProgress?.({ done: i, total, phase: pass.phase, depth: pass.depth });
      const fen = fens[i] as string;
      // A cached evaluation at the final depth also serves the quick pass.
      let e = (await cache.get(fen, depth)) ?? (await cache.get(fen, pass.depth));
      if (e) {
        if (pass.phase === "full") cacheHits++;
      } else {
        const terminal = terminalScore(fen);
        if (terminal) e = { score: terminal, best: null, pv: [], depth: 0 };
        else {
          e = await engine.analyse(fen, pass.depth, signal);
          if (e.nps) {
            npsSum += e.nps;
            npsN++;
          }
        }
        await cache.set(fen, pass.depth, e);
      }
      onEval?.(i, e, pass.phase);
    }
  }
  onProgress?.({ done: total, total, phase: "done", depth });
  const end = now();
  return {
    avgNps: npsN ? npsSum / npsN : null,
    msPerPosition: total ? (end - fullStart) / total : 0,
    totalMs: end - t0,
    cacheHits,
  };
}
