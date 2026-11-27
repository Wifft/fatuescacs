// Golden tests: classify recorded engine evaluations (never the live engine) and compare with
// hand-reviewed expectations. Regenerate with `pnpm golden:record` + `pnpm golden:expected`.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parsePgn } from "@/lib/chess/pgn";
import { buildReport } from "@/lib/chess/report";
import type { PositionEval } from "@/lib/engine/uci";

const ROOT = join(__dirname);
const ACCURACY_TOLERANCE = 0.5;

interface Recorded {
  fens: string[];
  evals: PositionEval[];
}
interface Expected {
  moves: string[];
  accuracy: { w: number | null; b: number | null };
}

function load(name: string) {
  const game = parsePgn(readFileSync(join(ROOT, "games", `${name}.pgn`), "utf8"));
  const rec = JSON.parse(readFileSync(join(ROOT, "evals", `${name}.json`), "utf8")) as Recorded;
  const exp = JSON.parse(readFileSync(join(ROOT, "expected", `${name}.json`), "utf8")) as Expected;
  const report = buildReport(game.moves, game.legalMoves, rec.evals);
  return { game, rec, exp, report };
}

const names = readdirSync(join(ROOT, "games"))
  .filter((f) => f.endsWith(".pgn"))
  .map((f) => f.replace(/\.pgn$/, ""));

describe("golden games", () => {
  it("has between 10 and 20 games", () => {
    expect(names.length).toBeGreaterThanOrEqual(10);
    expect(names.length).toBeLessThanOrEqual(20);
  });

  describe.each(names)("%s", (name) => {
    const { game, rec, exp, report } = load(name);

    it("recorded evals match the PGN positions", () => {
      expect(rec.fens).toEqual(game.fens);
      expect(rec.evals).toHaveLength(game.fens.length);
    });

    it("classifies every move as expected", () => {
      const got = game.moves.map(
        (m, i) =>
          `${m.moveNumber}${m.color === "w" ? "." : "..."} ${m.san} ${report.classes[i]?.cls}`,
      );
      const want = exp.moves.map((line) => line.split(" ").slice(0, 3).join(" "));
      expect(got).toEqual(want);
    });

    it("accuracy within tolerance", () => {
      for (const c of ["w", "b"] as const) {
        const want = exp.accuracy[c];
        const value = report.accuracy?.[c] ?? null;
        if (want === null) expect(value).toBeNull();
        else expect(Math.abs((value ?? NaN) - want)).toBeLessThanOrEqual(ACCURACY_TOLERANCE);
      }
    });
  });
});

describe("known cases", () => {
  const cls = (name: string, san: string, moveNumber: number) => {
    const { game, report } = load(name);
    const i = game.moves.findIndex((m) => m.san === san && m.moveNumber === moveNumber);
    expect(i, `${moveNumber}. ${san} in ${name}`).toBeGreaterThanOrEqual(0);
    return report.classes[i]?.cls;
  };

  it("Opera game: 15. Bxd7+ is not a mistake (PoC bug)", () => {
    expect(["best", "good"]).toContain(cls("opera", "Bxd7+", 15));
  });

  it("Opera game: the mating moves are best", () => {
    expect(cls("opera", "Qb8+", 16)).toBe("best");
    expect(cls("opera", "Rd8#", 17)).toBe("best");
  });

  it("Opera game: 16... Nxb8 is forced", () => {
    expect(cls("opera", "Nxb8", 16)).toBe("forced");
  });

  it("Fool's mate: 2. g4 is a blunder and 2... Qh4# is best", () => {
    expect(cls("fools-mate", "g4", 2)).toBe("blunder");
    expect(cls("fools-mate", "Qh4#", 2)).toBe("best");
  });

  it("Scholar's mate: 3... Nf6 is a blunder", () => {
    expect(cls("scholars-mate", "Nf6", 3)).toBe("blunder");
  });

  it("Légal's mate: 5... Bxd1 is a blunder", () => {
    expect(cls("legal", "Bxd1", 5)).toBe("blunder");
  });
});
