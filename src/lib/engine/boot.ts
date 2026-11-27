// Starts Stockfish in a Web Worker and performs the UCI handshake (uci → uciok → isready → readyok).
// Phase 1 turns this into the full engine wrapper (command queue, cancellation, analysis).
import { isReadyOk, isUciOk, parseIdName, toLine } from "./uci";

export type EngineBuild = "wasm" | "asm";

export interface EngineCandidate {
  url: string;
  build: EngineBuild;
}

export interface BootedEngine {
  worker: Worker;
  build: EngineBuild;
  name: string;
  loadMs: number;
}

export const ENGINE_CANDIDATES: readonly EngineCandidate[] = [
  { url: "/engine/stockfish-19-lite-single.js", build: "wasm" },
  { url: "/engine/stockfish-19-asm.js", build: "asm" },
];

export const BOOT_TIMEOUT_MS = 25_000;

/** Starts one engine build. Rejects (and terminates the worker) on error or timeout. */
export function startEngine(
  { url, build }: EngineCandidate,
  timeoutMs: number = BOOT_TIMEOUT_MS,
): Promise<BootedEngine> {
  return new Promise((resolve, reject) => {
    const t0 = performance.now();
    let worker: Worker;
    try {
      worker = new Worker(url);
    } catch (err) {
      reject(err instanceof Error ? err : new Error(String(err)));
      return;
    }

    let name = "";
    let settled = false;
    const fail = (err: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      worker.terminate();
      reject(err);
    };
    const timer = setTimeout(
      () => fail(new Error(`Engine ${url} did not answer within ${timeoutMs} ms`)),
      timeoutMs,
    );

    worker.onerror = (ev) => {
      ev.preventDefault();
      fail(new Error(`Engine ${url} failed to load: ${ev.message || "unknown error"}`));
    };
    worker.onmessage = (ev: MessageEvent) => {
      const line = toLine(ev.data);
      name = parseIdName(line) ?? name;
      if (isUciOk(line)) worker.postMessage("isready");
      else if (isReadyOk(line) && !settled) {
        settled = true;
        clearTimeout(timer);
        worker.onmessage = null;
        worker.onerror = null;
        resolve({ worker, build, name, loadMs: performance.now() - t0 });
      }
    };
    worker.postMessage("uci");
  });
}

/** Tries each build in order (WASM first, asm.js fallback) and returns the first that answers. */
export async function bootEngine(
  candidates: readonly EngineCandidate[] = ENGINE_CANDIDATES,
  timeoutMs: number = BOOT_TIMEOUT_MS,
): Promise<BootedEngine> {
  const errors: Error[] = [];
  for (const c of candidates) {
    try {
      return await startEngine(c, timeoutMs);
    } catch (err) {
      errors.push(err instanceof Error ? err : new Error(String(err)));
    }
  }
  throw new AggregateError(errors, "No engine build could be started");
}
