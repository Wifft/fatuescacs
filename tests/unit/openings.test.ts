import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { identifyOpening, toEpd, type OpeningTable } from "@/lib/chess/openings";
import { parsePgn } from "@/lib/chess/pgn";
import { buildReport } from "@/lib/chess/report";
import type { PositionEval } from "@/lib/engine/uci";

const table = (
  JSON.parse(readFileSync(join(__dirname, "../../public/openings.json"), "utf8")) as {
    positions: OpeningTable;
  }
).positions;

const fensOf = (pgn: string) => parsePgn(pgn).fens;

describe("toEpd", () => {
  it("drops the move counters", () => {
    expect(toEpd("rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1")).toBe(
      "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq -",
    );
  });
});

describe("identifyOpening (real dataset)", () => {
  it("finds the deepest named position", () => {
    const r = identifyOpening(fensOf("1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 *"), table);
    expect(r.opening?.eco).toBe("C70");
    expect(r.opening?.name).toMatch(/^Ruy Lopez/);
    expect(r.opening?.ply).toBe(6);
    expect(r.bookPlies).toBe(6);
  });

  it("identifies the Opera game as a Philidor Defense and stops book when it leaves theory", () => {
    const pgn = readFileSync(join(__dirname, "../golden/games/opera.pgn"), "utf8");
    const r = identifyOpening(fensOf(pgn), table);
    expect(r.opening?.eco).toBe("C41");
    expect(r.opening?.name).toMatch(/Philidor Defense/);
    expect(r.bookPlies).toBeGreaterThanOrEqual(5);
    expect(r.bookPlies).toBeLessThan(20);
  });

  it("handles transpositions (1. Nf3 d5 2. d4 reaches a Queen's Pawn position)", () => {
    const r = identifyOpening(fensOf("1. Nf3 d5 2. d4 *"), table);
    expect(r.opening).not.toBeNull();
    expect(r.bookPlies).toBe(3);
  });

  it("returns nothing for custom start positions", () => {
    const r = identifyOpening(
      fensOf('[SetUp "1"]\n[FEN "4k3/8/8/8/8/8/4P3/4K3 w - - 0 1"]\n\n1. e4 *'),
      table,
    );
    expect(r).toEqual({ opening: null, bookPlies: 0 });
  });

  it("book stops at the first position outside the table", () => {
    const fens = fensOf("1. e4 e5 2. Nf3 *");
    const tiny: OpeningTable = { [toEpd(fens[1] as string)]: ["B00", "King's Pawn"] };
    expect(identifyOpening(fens, tiny)).toEqual({
      opening: { eco: "B00", name: "King's Pawn", ply: 1 },
      bookPlies: 1,
    });
    expect(identifyOpening(fens, {}).bookPlies).toBe(0);
  });
});

describe("book moves in the report", () => {
  it("marks leading book moves and excludes them from accuracy", () => {
    const game = parsePgn("1. e4 e5 2. Qh5 *");
    const ev = (cp: number, best: string): PositionEval => ({
      score: { kind: "cp", cp },
      best,
      pv: [best],
      depth: 10,
    });
    const evals = [ev(20, "e2e4"), ev(20, "e7e5"), ev(20, "g1f3"), ev(-150, "b8c6")];
    const r = buildReport(game.moves, game.legalMoves, evals, { bookPlies: 2 });
    expect(r.classes.map((c) => c?.cls)).toEqual(["book", "book", "mistake"]);
    expect(r.accuracy?.b).toBeNull();
    expect(r.accuracy?.w).not.toBeNull();
  });
});
