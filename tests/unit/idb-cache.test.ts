import { IDBFactory } from "fake-indexeddb";
import { describe, expect, it } from "vitest";
import { IdbEvalCache } from "@/lib/engine/idb-cache";
import type { PositionEval } from "@/lib/engine/uci";

const FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const E: PositionEval = {
  score: { kind: "cp", cp: 25 },
  best: "e2e4",
  pv: ["e2e4", "e7e5"],
  depth: 16,
  nps: 500000,
};

describe("IdbEvalCache", () => {
  it("persists across instances (same IndexedDB), keyed by FEN + depth", async () => {
    const factory = new IDBFactory();
    const a = new IdbEvalCache(factory);
    await a.set(FEN, 16, E);
    const b = new IdbEvalCache(factory);
    expect(await b.get(FEN, 16)).toEqual({
      score: { kind: "cp", cp: 25 },
      best: "e2e4",
      pv: ["e2e4", "e7e5"],
      depth: 16,
    });
    expect(await b.get(FEN, 12)).toBeUndefined();
  });

  it("works in memory when IndexedDB is unavailable", async () => {
    const broken = {
      open: () => {
        throw new Error("no idb");
      },
    } as unknown as IDBFactory;
    const c = new IdbEvalCache(broken);
    await c.set(FEN, 10, E);
    expect((await c.get(FEN, 10))?.best).toBe("e2e4");
  });
});
