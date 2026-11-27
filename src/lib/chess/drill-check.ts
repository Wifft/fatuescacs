// Grading a training answer. Pure: the engine evaluations are passed in.
import { CLASSIFY_THRESHOLDS } from "./classify";
import { winFor, type Score } from "./eval";

export type DrillVerdict = "best" | "good-enough" | "wrong";

/** Engine depth used to grade answers that are not the engine's move. */
export const DRILL_CHECK_DEPTH = 14;

/**
 * @param bestScore engine score of the position (after its best move), white POV.
 * @param answerScore engine score after the user's move, white POV.
 * An answer counts if it loses less than the "Good" threshold (5 win-probability points).
 */
export function gradeAnswer(
  color: "w" | "b",
  answerUci: string,
  bestUci: string,
  bestScore?: Score,
  answerScore?: Score,
): { verdict: DrillVerdict; loss: number } {
  if (answerUci === bestUci) return { verdict: "best", loss: 0 };
  if (!bestScore || !answerScore) return { verdict: "wrong", loss: 100 };
  const loss = Math.max(0, winFor(bestScore, color) - winFor(answerScore, color));
  return { verdict: loss < CLASSIFY_THRESHOLDS.good ? "good-enough" : "wrong", loss };
}
