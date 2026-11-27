import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import {
  computeStats,
  movedPiece,
  nonPawnMaterial,
  phaseOf,
  type StatsGame,
} from "@/lib/chess/stats";
import type { PositionEval } from "@/lib/engine/uci";
import { getAnalysis, listAnalyses, saveAnalysis, statsGames } from "@/server/analyses";
import { register } from "@/server/auth";
import { openDb, type Db } from "@/server/db";
import { answerDrill, BOX_INTERVAL_DAYS, dueDrills } from "@/server/drills";

const DAY = 86_400_000;
const dir = join(__dirname, "../golden");
const load = (name: string) => ({
  pgn: readFileSync(join(dir, "games", `${name}.pgn`), "utf8"),
  evals: (
    JSON.parse(readFileSync(join(dir, "evals", `${name}.json`), "utf8")) as {
      evals: PositionEval[];
    }
  ).evals,
});

describe("phase heuristic", () => {
  const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
  it("counts non-pawn material of both sides", () => {
    expect(nonPawnMaterial(START)).toBe(62);
    expect(nonPawnMaterial("4k3/8/8/8/8/8/4P3/4K3 w - - 0 1")).toBe(0);
    expect(nonPawnMaterial("r3k3/8/8/8/8/8/8/R3K2Q w - - 0 1")).toBe(19);
  });
  it("classifies opening, middlegame and endgame", () => {
    expect(phaseOf(START, 0)).toBe("opening");
    expect(phaseOf(START, 20)).toBe("middlegame"); // too late to be the opening
    // Queens off early: 62 - 18 = 44 < 52 → middlegame even at ply 10.
    expect(phaseOf("rnb1kbnr/pppppppp/8/8/8/8/PPPPPPPP/RNB1KBNR w KQkq - 0 6", 10)).toBe(
      "middlegame",
    );
    expect(phaseOf("r3k3/8/8/8/8/8/8/R3K2Q w - - 0 40", 80)).toBe("endgame");
  });
  it("finds the piece that moved", () => {
    expect(movedPiece("Nf3")).toBe("n");
    expect(movedPiece("exd5")).toBe("p");
    expect(movedPiece("O-O-O")).toBe("k");
    expect(movedPiece("Qxf7#")).toBe("q");
  });
});

describe("computeStats", () => {
  const opera = load("opera");
  const legal = load("legal");
  const games: StatsGame[] = [
    // As Black in the Opera game (loses), as White in Légal (wins).
    {
      ...opera,
      bookPlies: 0,
      userColor: "b",
      opening: { eco: "C41", name: "Philidor" },
      result: "1-0",
    },
    {
      ...legal,
      bookPlies: 0,
      userColor: "w",
      opening: { eco: "C41", name: "Philidor" },
      result: "1-0",
    },
  ];

  it("aggregates the user's moves per phase and their errors", () => {
    const s = computeStats(games);
    expect(s.games).toBe(2);
    expect(s.moves).toBeGreaterThan(0);
    const phaseMoves = s.phases.opening.moves + s.phases.middlegame.moves + s.phases.endgame.moves;
    expect(phaseMoves).toBe(s.moves);
    // Black's 15... Nxd7 in the Opera game allows mate.
    expect(s.errors.byKind["allows-mate"]).toBeGreaterThanOrEqual(1);
    expect(s.errors.total).toBe(Object.values(s.errors.byPhase).reduce((a, b) => a + b, 0));
  });

  it("groups openings with results from the user's point of view", () => {
    const s = computeStats(games);
    expect(s.openings).toHaveLength(1);
    expect(s.openings[0]).toMatchObject({ eco: "C41", games: 2, wins: 1, losses: 1, score: 0.5 });
  });

  it("sorts the worst opening first and survives broken games", () => {
    const s = computeStats([
      { ...games[1]!, opening: { eco: "C40", name: "Ganada" } },
      { ...games[0]!, opening: { eco: "C41", name: "Perdida" } },
      { ...games[0]!, pgn: "esto no es un pgn" },
    ]);
    expect(s.games).toBe(2);
    expect(s.openings.map((o) => o.name)).toEqual(["Perdida", "Ganada"]);
  });
});

describe("drills (Leitner)", () => {
  let db: Db;
  let userId: number;
  const opera = load("opera");
  beforeEach(async () => {
    db = openDb(":memory:");
    userId = (await register(db, "alumno", "12345678")).user.id;
  });

  it("saving as Black creates drills from Black's mistakes and blunders only", () => {
    const id = saveAnalysis(db, userId, { ...opera, depth: 16, userColor: "b" }, 1000);
    expect(getAnalysis(db, userId, id)?.userColor).toBe("b");
    const { drills, total, due } = dueDrills(db, userId, 1000);
    expect(total).toBeGreaterThanOrEqual(2); // 9... b5 (mistake) and 15... Nxd7 (blunder)
    expect(due).toBe(total);
    expect(drills.every((d) => d.fen.split(" ")[1] === "b")).toBe(true);
    expect(drills[0]?.cls).toBe("blunder"); // blunders first
    expect(drills.find((d) => d.ply === 30)?.bestUci).toBe("e6d7"); // 15... Qxd7
  });

  it("no drills when the user didn't play, and changing sides replaces them", () => {
    saveAnalysis(db, userId, { ...opera, depth: 16 }, 1000);
    expect(dueDrills(db, userId, 1000).total).toBe(0);
    saveAnalysis(db, userId, { ...opera, depth: 16, userColor: "w" }, 2000);
    const white = dueDrills(db, userId, 2000).drills;
    expect(white.every((d) => d.fen.split(" ")[1] === "w")).toBe(true);
    expect(statsGames(db, userId)).toHaveLength(1);
    expect(listAnalyses(db, userId)[0]?.userColor).toBe("w");
  });

  it("moves up a box when correct and back to box 1 when wrong", () => {
    saveAnalysis(db, userId, { ...opera, depth: 16, userColor: "b" }, 0);
    const d = dueDrills(db, userId, 0).drills[0]!;
    let r = answerDrill(db, userId, d.id, true, 0)!;
    expect(r).toMatchObject({
      box: 1,
      dueAt: BOX_INTERVAL_DAYS[0] * DAY,
      reviews: 1,
      lastCorrect: true,
    });
    r = answerDrill(db, userId, d.id, true, DAY)!;
    expect(r).toMatchObject({ box: 2, dueAt: DAY + BOX_INTERVAL_DAYS[1] * DAY });
    // Not due any more until then.
    expect(dueDrills(db, userId, DAY).drills.some((x) => x.id === d.id)).toBe(false);
    r = answerDrill(db, userId, d.id, false, 5 * DAY)!;
    expect(r).toMatchObject({ box: 1, dueAt: 6 * DAY, lastCorrect: false });
    for (let k = 0; k < 10; k++) r = answerDrill(db, userId, d.id, true, 0)!;
    expect(r.box).toBe(5);
  });

  it("re-saving keeps drill progress, and other users can't answer them", async () => {
    saveAnalysis(db, userId, { ...opera, depth: 16, userColor: "b" }, 0);
    const d = dueDrills(db, userId, 0).drills[0]!;
    answerDrill(db, userId, d.id, true, 0);
    saveAnalysis(db, userId, { ...opera, depth: 16, userColor: "b" }, 10);
    expect(dueDrills(db, userId, 10 * DAY).drills.find((x) => x.id === d.id)?.box).toBe(1);
    const other = (await register(db, "otro", "12345678")).user.id;
    expect(answerDrill(db, other, d.id, true)).toBeNull();
    expect(dueDrills(db, other).total).toBe(0);
  });

  it("rejects an invalid colour", () => {
    expect(() => saveAnalysis(db, userId, { ...opera, depth: 16, userColor: "x" })).toThrow();
  });
});
