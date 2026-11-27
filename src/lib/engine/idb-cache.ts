// Persistent evaluation cache in IndexedDB (by FEN + depth), with an in-memory layer in front.
// Falls back to memory only when IndexedDB is unavailable (private mode, blocked storage…).
import { EvalCache, type EvalStore } from "./analyzer";
import type { PositionEval } from "./uci";

const DB_NAME = "fatuescacs";
const DB_VERSION = 1;
const STORE = "evals";

const key = (fen: string, depth: number) => `${fen}|${depth}`;

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export function openEvalDb(factory: IDBFactory = indexedDB): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = factory.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error("IndexedDB blocked"));
  });
}

export class IdbEvalCache implements EvalStore {
  private memory = new EvalCache();
  private db: Promise<IDBDatabase | null>;

  constructor(factory?: IDBFactory) {
    this.db = (async () => {
      try {
        const f = factory ?? globalThis.indexedDB;
        return f ? await openEvalDb(f) : null;
      } catch {
        return null;
      }
    })();
  }

  async get(fen: string, depth: number): Promise<PositionEval | undefined> {
    const hit = this.memory.get(fen, depth);
    if (hit) return hit;
    const db = await this.db;
    if (!db) return undefined;
    try {
      const value = await request<PositionEval | undefined>(
        db.transaction(STORE, "readonly").objectStore(STORE).get(key(fen, depth)),
      );
      if (value) this.memory.set(fen, depth, value);
      return value;
    } catch {
      return undefined;
    }
  }

  async set(fen: string, depth: number, e: PositionEval): Promise<void> {
    // Store only what is needed to rebuild the report (no nps).
    const value: PositionEval = { score: e.score, best: e.best, pv: e.pv, depth: e.depth };
    this.memory.set(fen, depth, value);
    const db = await this.db;
    if (!db) return;
    try {
      await request(
        db.transaction(STORE, "readwrite").objectStore(STORE).put(value, key(fen, depth)),
      );
    } catch {
      /* quota exceeded or storage cleared: the memory layer still works */
    }
  }
}
