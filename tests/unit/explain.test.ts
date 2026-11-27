import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { formatScore } from "@/lib/chess/eval";
import { explainMove, forcingLine, type Explanation } from "@/lib/chess/explain";
import { numberLine } from "@/lib/chess/line";
import { toSpanishSan } from "@/lib/chess/notation";
import { parsePgn } from "@/lib/chess/pgn";
import { buildReport } from "@/lib/chess/report";
import type { PositionEval } from "@/lib/engine/uci";
import { describePieces, explanationText } from "@/messages/es";

/** Explanation of a move in a golden game, using its recorded evaluations. */
function golden(name: string, moveNumber: number, san: string): Explanation | null {
  const dir = join(__dirname, "../golden");
  const g = parsePgn(readFileSync(join(dir, "games", `${name}.pgn`), "utf8"));
  const { evals } = JSON.parse(readFileSync(join(dir, "evals", `${name}.json`), "utf8")) as {
    evals: PositionEval[];
  };
  const r = buildReport(g.moves, g.legalMoves, evals);
  const i = g.moves.findIndex((m) => m.moveNumber === moveNumber && m.san === san);
  const m = g.moves[i]!;
  return explainMove({
    fenBefore: m.fenBefore,
    playedUci: m.uci,
    before: evals[i]!,
    after: evals[i + 1]!,
    classification: r.classes[i]!,
  });
}

const text = (e: Explanation | null) =>
  e
    ? explanationText(
        e,
        (fen, san) => numberLine(fen, san.map(toSpanishSan)),
        (s) => formatScore(s),
      )
    : null;

describe("explanations of real mistakes (golden games)", () => {
  it("Opera 15... Nxd7 allows mate in 2", () => {
    const e = golden("opera", 15, "Nxd7");
    expect(e).toMatchObject({ kind: "allows-mate", mateIn: 2, line: ["Qb8+", "Nxb8", "Rd8#"] });
    expect(text(e)).toBe("Permite mate en 2: 16. Db8+ Cxb8 17. Td8#.");
  });

  it("Scholar's mate 3... Nf6 allows immediate mate", () => {
    expect(text(golden("scholars-mate", 3, "Nf6"))).toBe("Permite mate inmediato: 4. Dxf7#.");
  });

  it("Légal's mate 5... Bxd1 allows mate in 2", () => {
    expect(golden("legal", 5, "Bxd1")).toMatchObject({ kind: "allows-mate", mateIn: 2 });
  });

  it("2... d5 lets White take the knight on f6", () => {
    const e = golden("en-passant-promotion", 2, "d5");
    expect(e).toMatchObject({ kind: "hanging", piece: "n", square: "f6", capture: "exf6" });
    expect(text(e)).toBe("El rival se lleva tu caballo de f6 con 3. exf6.");
  });

  it("3. exd6 (en passant) misses exf6, which wins a knight", () => {
    const e = golden("en-passant-promotion", 3, "exd6");
    expect(e).toMatchObject({ kind: "missed-tactic", best: "exf6", won: { n: 1 } });
    expect(text(e)).toBe("Se te escapa 3. exf6, que gana un caballo.");
  });

  it("4... Nd5 loses the queen to a promotion", () => {
    expect(golden("en-passant-promotion", 4, "Nd5")).toMatchObject({
      kind: "hanging",
      piece: "q",
      square: "d8",
    });
  });

  it("quiet mistakes fall back to the evaluation change", () => {
    const e = golden("opera", 9, "b5");
    expect(e).toMatchObject({ kind: "eval-swing", best: "a6" });
    expect(text(e)).toBe("La evaluación pasa de +2.5 a +4.3; 9… a6 era mejor.");
  });

  it("good, best, book and forced moves have no explanation", () => {
    expect(golden("opera", 15, "Bxd7+")).toBeNull();
    expect(golden("opera", 16, "Nxb8")).toBeNull();
  });
});

describe("synthetic cases", () => {
  const cp = (v: number) => ({ kind: "cp" as const, cp: v });

  it("throwing away a forced mate", () => {
    // White mates with Ra8# (back rank); Kh2 throws it away.
    const e = explainMove({
      fenBefore: "6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1",
      playedUci: "g1h1",
      before: { score: { kind: "mate", mate: 1 }, best: "a1a8", pv: ["a1a8"] },
      after: { score: cp(500), pv: ["h7h6"] },
      classification: { cls: "mistake", reason: "lost-mate" },
    });
    expect(e).toMatchObject({ kind: "lost-mate", mateIn: 1, best: "Ra8#" });
    expect(text(e)).toBe("Había mate en 1 empezando con 1. Ta8#; tras esta jugada ya no.");
  });

  it("losing material through an exchange sequence", () => {
    // 1... Nxe4?? 2. Nxe4: Black gives a knight for a pawn.
    const fen = "r1bqkb1r/pppp1ppp/2n2n2/4p3/4P3/2N2N2/PPPP1PPP/R1BQKB1R b KQkq - 5 4";
    const e = explainMove({
      fenBefore: fen,
      playedUci: "f6e4",
      before: { score: cp(-20), best: "f8b4", pv: ["f8b4"] },
      after: { score: cp(250), pv: ["c3e4", "d7d5", "e4g3"] },
      classification: { cls: "blunder" },
    });
    expect(e?.kind).toMatch(/hanging|loses-material/);
    expect(e && "balance" in e ? e.balance : 0).toBe(-2);
  });
});

describe("forcingLine", () => {
  it("stops before the first quiet move and measures material", () => {
    const start = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
    const r = forcingLine(start, ["e2e4", "e7e5", "g1f3"], "w", 1);
    expect(r.san).toEqual(["e4"]);
    expect(r.balance).toBe(0);
  });
  it("ignores illegal moves in the line", () => {
    const start = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
    expect(forcingLine(start, ["e2e5"], "w").san).toEqual([]);
  });
});

describe("describePieces", () => {
  it("names pieces in Spanish with articles and counts", () => {
    expect(describePieces({ n: 1 })).toBe("un caballo");
    expect(describePieces({ q: 1 })).toBe("una dama");
    expect(describePieces({ p: 2 })).toBe("dos peones");
    expect(describePieces({ r: 1, b: 1, p: 1 })).toBe("una torre, un alfil y un peón");
    expect(describePieces({})).toBe("material");
  });
});
