// Builds the game report (classes, accuracy, counts) from evaluations. Pure.
import { gameAccuracy, type PlayerAccuracy } from "./accuracy";
import {
  classifyMove,
  CLASSIFY_THRESHOLDS,
  type Classification,
  type ClassifyThresholds,
} from "./classify";
import { winWhite, type Score } from "./eval";

export interface ReportMove {
  color: "w" | "b";
  uci: string;
}

export interface ReportEval {
  score: Score;
  best: string | null;
}

export interface ColorCounts {
  inaccuracy: number;
  mistake: number;
  blunder: number;
}

export interface GameReport {
  /** classes[i] classifies move i (from position i to i + 1); null until both evals exist. */
  classes: (Classification | null)[];
  /** Null until every position is evaluated. */
  accuracy: PlayerAccuracy | null;
  counts: { w: ColorCounts; b: ColorCounts };
}

export function buildReport(
  moves: readonly ReportMove[],
  legalMoves: readonly number[],
  evals: readonly (ReportEval | null | undefined)[],
  t: ClassifyThresholds = CLASSIFY_THRESHOLDS,
): GameReport {
  const counts = {
    w: { inaccuracy: 0, mistake: 0, blunder: 0 },
    b: { inaccuracy: 0, mistake: 0, blunder: 0 },
  };
  const classes = moves.map((m, i) => {
    const before = evals[i];
    const after = evals[i + 1];
    if (!before || !after) return null;
    const c = classifyMove(
      {
        color: m.color,
        playedUci: m.uci,
        bestUci: before.best,
        before: before.score,
        after: after.score,
        legalMoves: legalMoves[i] ?? 2,
      },
      t,
    );
    if (c.cls === "inaccuracy" || c.cls === "mistake" || c.cls === "blunder")
      counts[m.color][c.cls]++;
    return c;
  });

  const complete = evals.length === moves.length + 1 && evals.every(Boolean);
  const accuracy = complete
    ? gameAccuracy(
        evals.map((e) => winWhite((e as ReportEval).score)),
        moves.map((m, i) => {
          const c = classes[i];
          return {
            color: m.color,
            loss: c?.loss ?? 0,
            counts: c ? c.cls !== "forced" && c.cls !== "book" : false,
          };
        }),
      )
    : null;

  return { classes, accuracy, counts };
}
