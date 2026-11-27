import { describe, expect, it } from "vitest";
import { parsePgn, PgnError } from "@/lib/chess/pgn";
import { displaySan, toSpanishSan } from "@/lib/chess/notation";

const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

function expectPgnError(text: string): PgnError {
  try {
    parsePgn(text);
  } catch (e) {
    expect(e).toBeInstanceOf(PgnError);
    return e as PgnError;
  }
  throw new Error("expected a PgnError");
}

describe("parsePgn", () => {
  it("returns positions, SAN, UCI and colours", () => {
    const g = parsePgn("1. e4 e5 2. Nf3 Nc6 *");
    expect(g.fens).toHaveLength(5);
    expect(g.fens[0]).toBe(START);
    expect(g.moves.map((m) => m.san)).toEqual(["e4", "e5", "Nf3", "Nc6"]);
    expect(g.moves.map((m) => m.uci)).toEqual(["e2e4", "e7e5", "g1f3", "b8c6"]);
    expect(g.moves.map((m) => m.color)).toEqual(["w", "b", "w", "b"]);
    expect(g.moves.map((m) => m.moveNumber)).toEqual([1, 1, 2, 2]);
    expect(g.legalMoves[0]).toBe(20);
    expect(g.moves[1]?.fenBefore).toBe(g.fens[1]);
  });

  it("keeps real headers and drops chess.js placeholders", () => {
    const g = parsePgn('[White "Morphy"]\n[Result "1-0"]\n\n1. e4 1-0');
    expect(g.headers.White).toBe("Morphy");
    expect(g.headers.Result).toBe("1-0");
    expect(g.headers.Black).toBeUndefined();
    expect(g.headers.Date).toBeUndefined();
  });

  it("handles comments, variations and NAGs (main line only)", () => {
    const g = parsePgn("1. e4 {comentario} e5 (1... c5 2. Nf3) 2. Nf3 $1 Nc6 3. Bb5!? a6 *");
    expect(g.moves.map((m) => m.san)).toEqual(["e4", "e5", "Nf3", "Nc6", "Bb5", "a6"]);
  });

  it("supports castling on both sides", () => {
    const g = parsePgn(
      "1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. O-O d6 5. d3 Be6 6. Nc3 Qd7 7. Be3 O-O-O *",
    );
    const wk = g.moves.find((m) => m.san === "O-O");
    const bq = g.moves.find((m) => m.san === "O-O-O");
    expect(wk?.uci).toBe("e1g1");
    expect(bq?.uci).toBe("e8c8");
  });

  it("supports en passant", () => {
    const g = parsePgn("1. e4 a6 2. e5 d5 3. exd6 *");
    const ep = g.moves[4];
    expect(ep?.san).toBe("exd6");
    expect(ep?.uci).toBe("e5d6");
    expect(g.fens[5]?.split(" ")[0]).toBe("rnbqkbnr/1pp1pppp/p2P4/8/8/8/PPPP1PPP/RNBQKBNR");
  });

  it("supports promotion and a custom start position (FEN header)", () => {
    const pgn = '[SetUp "1"]\n[FEN "8/P7/8/8/8/8/k6K/8 w - - 0 40"]\n\n40. a8=Q+ Kb3 *';
    const g = parsePgn(pgn);
    expect(g.startFen).toBe("8/P7/8/8/8/8/k6K/8 w - - 0 40");
    expect(g.moves[0]?.uci).toBe("a7a8q");
    expect(g.moves[0]?.promotion).toBe("q");
    expect(g.moves.map((m) => m.moveNumber)).toEqual([40, 40]);
  });

  it("numbers moves correctly when the custom position has black to move", () => {
    const g = parsePgn(
      '[SetUp "1"]\n[FEN "4k3/8/8/8/8/8/4P3/4K3 b - - 0 12"]\n\n12... Kd7 13. e4 *',
    );
    expect(g.moves.map((m) => [m.moveNumber, m.color])).toEqual([
      [12, "b"],
      [13, "w"],
    ]);
  });

  it("detects mate in the last position", () => {
    const g = parsePgn("1. f3 e5 2. g4 Qh4# 0-1");
    expect(g.legalMoves.at(-1)).toBe(0);
  });

  it("accepts a FEN-only game with no moves", () => {
    const g = parsePgn('[SetUp "1"]\n[FEN "4k3/8/8/8/8/8/4P3/4K3 w - - 0 1"]\n\n*');
    expect(g.moves).toHaveLength(0);
    expect(g.fens).toEqual(["4k3/8/8/8/8/8/4P3/4K3 w - - 0 1"]);
  });

  describe("errors", () => {
    it("rejects empty input", () => {
      expect(expectPgnError("   \n").kind).toBe("empty");
    });
    it("locates an illegal move with its number and line", () => {
      const e = expectPgnError("1. e4 e5 2. Nf3 Nc6\n3. Bb5 a6 4. Bxe7 Nf6");
      expect(e.kind).toBe("illegal-move");
      expect(e.moveText).toBe("Bxe7");
      expect(e.moveNumber).toBe(4);
      expect(e.line).toBe(2);
      expect(e.column).toBe(14);
    });
    it("ignores the same text inside comments when locating", () => {
      const e = expectPgnError("1. e4 {Bxe7 no} e5 2. Bxe7 *");
      expect(e.moveNumber).toBe(2);
      expect(e.column).toBe(23);
    });
    it("reports syntax errors with line and column", () => {
      const e = expectPgnError("1. e4 e5\n2. @@@ Nc6");
      expect(e.kind).toBe("syntax");
      expect(e.line).toBe(2);
      expect(e.column).toBe(4);
    });
  });
});

describe("notation", () => {
  it("translates pieces to Spanish", () => {
    expect(toSpanishSan("Nf3")).toBe("Cf3");
    expect(toSpanishSan("Bxd7+")).toBe("Axd7+");
    expect(toSpanishSan("Qb8+")).toBe("Db8+");
    expect(toSpanishSan("Rd8#")).toBe("Td8#");
    expect(toSpanishSan("Kxe2")).toBe("Rxe2");
    expect(toSpanishSan("exd8=Q+")).toBe("exd8=D+");
    expect(toSpanishSan("O-O-O")).toBe("O-O-O");
    expect(toSpanishSan("bxc3")).toBe("bxc3");
  });
  it("leaves English untouched", () => {
    expect(displaySan("Nf3", "en")).toBe("Nf3");
    expect(displaySan("Nf3", "es")).toBe("Cf3");
  });
});
