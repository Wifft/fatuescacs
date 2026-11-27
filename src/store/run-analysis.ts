"use client";

import { analyzeGame } from "@/lib/engine/analyzer";
import { IdbEvalCache } from "@/lib/engine/idb-cache";
import { getBrowserEngine } from "@/lib/engine/browser";
import { isAbortError } from "@/lib/engine/engine";
import type { PositionEval } from "@/lib/engine/uci";
import { useAnalysis } from "./analysis";

// Persistent across reloads (IndexedDB), with an in-memory layer.
let cache: IdbEvalCache | null = null;

export function getEvalCache(): IdbEvalCache {
  return (cache ??= new IdbEvalCache());
}
let current: AbortController | null = null;
let running: Promise<unknown> | null = null;

/**
 * Analyses the game in the store at the store's depth. Starting a new analysis cancels the
 * previous one (stop → wait for bestmove → discard), so results never mix.
 */
export async function runAnalysis(): Promise<void> {
  current?.abort();
  const ctrl = new AbortController();
  current = ctrl;
  // Wait for the previous run to unwind before touching the engine or the store.
  await running?.catch(() => undefined);
  if (ctrl.signal.aborted) return;

  const store = useAnalysis.getState();
  const game = store.game;
  if (!game) return;
  const depth = store.depth;

  const job = (async () => {
    if (store.engineStatus !== "ready") store.setEngine("loading");
    let booted;
    try {
      booted = await getBrowserEngine();
    } catch {
      useAnalysis.getState().setEngine("error", null);
      return;
    }
    const s = useAnalysis.getState();
    s.setEngine("ready", { name: booted.name, build: booted.build, loadMs: booted.loadMs });
    s.setMetrics(null);
    const batch = evalBatcher(() => ctrl.signal.aborted);

    const metrics = await analyzeGame({
      engine: booted.engine,
      fens: game.fens,
      depth,
      cache: getEvalCache(),
      signal: ctrl.signal,
      onEval: (i, e) => {
        if (!ctrl.signal.aborted) batch.push(i, e);
      },
      onProgress: (p) => {
        if (!ctrl.signal.aborted) useAnalysis.getState().setProgress(p);
      },
    });
    batch.flush();
    if (!ctrl.signal.aborted) useAnalysis.getState().setMetrics(metrics);
  })();

  running = job;
  try {
    await job;
  } catch (err) {
    if (!isAbortError(err)) throw err;
  } finally {
    if (running === job) running = null;
  }
}

export function cancelAnalysis() {
  current?.abort();
}

/** Evaluations arrive every few ms from the cache: group them into one store update per frame
 * window so the board, move list and curve re-render at most ~7 times per second. */
const FLUSH_MS = 150;
function evalBatcher(aborted: () => boolean) {
  let pending: [number, PositionEval][] = [];
  let timer: ReturnType<typeof setTimeout> | null = null;
  const flush = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    const updates = pending;
    pending = [];
    if (!aborted()) useAnalysis.getState().setEvals(updates);
  };
  return {
    push(i: number, e: PositionEval) {
      pending.push([i, e]);
      timer ??= setTimeout(flush, FLUSH_MS);
    },
    flush,
  };
}
