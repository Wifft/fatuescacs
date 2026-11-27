// UCI engine wrapper: serialized command queue, real cancellation, white-POV results.
// Transport-agnostic so it runs on a browser Worker and on the Node build of stockfish.js.
import {
  isReadyOk,
  parseBestMove,
  parseInfo,
  toLine,
  toPositionEval,
  type PositionEval,
  type UciInfo,
} from "./uci";

export interface EngineTransport {
  post(command: string): void;
  /** Registers the single line listener. */
  onLine(listener: (line: string) => void): void;
  terminate(): void;
}

export interface AnalysisEngine {
  newGame(): Promise<void>;
  analyse(fen: string, depth: number, signal?: AbortSignal): Promise<PositionEval>;
}

export class AbortError extends Error {
  constructor() {
    super("Analysis aborted");
    this.name = "AbortError";
  }
}

export const isAbortError = (e: unknown): e is AbortError =>
  e instanceof Error && e.name === "AbortError";

/** Safety net: a single `go depth` that takes longer than this is stopped. */
const GO_TIMEOUT_MS = 120_000;

export class Engine implements AnalysisEngine {
  private listener: ((line: string) => void) | null = null;
  private chain: Promise<unknown> = Promise.resolve();
  private terminated = false;

  constructor(private readonly transport: EngineTransport) {
    transport.onLine((raw) => this.listener?.(toLine(raw)));
  }

  /** Applies the project options (Hash 32, MultiPV 1) and waits for readyok. */
  configure(): Promise<void> {
    return this.enqueue(async () => {
      this.transport.post("setoption name Hash value 32");
      this.transport.post("setoption name MultiPV value 1");
      await this.sync();
    });
  }

  newGame(): Promise<void> {
    return this.enqueue(async () => {
      this.transport.post("ucinewgame");
      await this.sync();
    });
  }

  analyse(fen: string, depth: number, signal?: AbortSignal): Promise<PositionEval> {
    return this.enqueue(() => this.runGo(fen, depth, signal));
  }

  terminate(): void {
    this.terminated = true;
    this.listener = null;
    this.transport.terminate();
  }

  private enqueue<T>(task: () => Promise<T>): Promise<T> {
    const run = this.chain.then(task, task);
    this.chain = run.catch(() => undefined);
    return run;
  }

  private sync(): Promise<void> {
    return new Promise((resolve) => {
      this.listener = (line) => {
        if (isReadyOk(line)) {
          this.listener = null;
          resolve();
        }
      };
      this.transport.post("isready");
    });
  }

  private runGo(fen: string, depth: number, signal?: AbortSignal): Promise<PositionEval> {
    if (this.terminated) return Promise.reject(new Error("Engine terminated"));
    if (signal?.aborted) return Promise.reject(new AbortError());
    const sideToMove = fen.split(" ")[1] === "b" ? "b" : "w";

    return new Promise((resolve, reject) => {
      let last: UciInfo | null = null;
      let aborted = false;
      const stop = () => {
        if (aborted) return;
        aborted = true;
        this.transport.post("stop");
      };
      const onAbort = () => stop();
      signal?.addEventListener("abort", onAbort, { once: true });
      const timer = setTimeout(stop, GO_TIMEOUT_MS);

      this.listener = (line) => {
        const info = parseInfo(line);
        if (info) {
          // Keep the main line; prefer exact scores over lower/upper bounds at the same depth.
          if (info.multipv === 1 && (!info.score.bound || !last || info.depth > last.depth)) {
            last = info;
          }
          return;
        }
        const bm = parseBestMove(line);
        if (!bm) return;
        // The engine always answers `stop` with a bestmove, so the queue never desyncs.
        this.listener = null;
        clearTimeout(timer);
        signal?.removeEventListener("abort", onAbort);
        if (aborted && signal?.aborted) reject(new AbortError());
        else resolve(toPositionEval(last, bm, sideToMove));
      };
      this.transport.post(`position fen ${fen}`);
      this.transport.post(`go depth ${depth}`);
    });
  }
}

/** Wraps a browser Worker that speaks UCI over postMessage. */
export function workerTransport(worker: Worker): EngineTransport {
  return {
    post: (c) => worker.postMessage(c),
    onLine: (l) => {
      worker.onmessage = (ev: MessageEvent) => l(String(ev.data));
    },
    terminate: () => worker.terminate(),
  };
}
