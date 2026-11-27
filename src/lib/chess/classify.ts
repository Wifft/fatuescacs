// Move classification (spec section 6). Pure: works on recorded evaluations.
import { isMateFor, winFor, type Score } from "./eval";

export type MoveClass = "best" | "good" | "inaccuracy" | "mistake" | "blunder" | "forced" | "book";

/** All tunable thresholds. Win-probability values are percentage points (0–100). */
export const CLASSIFY_THRESHOLDS = {
  /** loss < good → Good */
  good: 5,
  /** loss < inaccuracy → Inaccuracy */
  inaccuracy: 10,
  /** loss < mistake → Mistake, otherwise Blunder */
  mistake: 20,
  /** winAfter ≥ stillWinning (for the mover) → at most Good, unless a forced mate was lost */
  stillWinning: 90,
  /** winBefore ≤ lostPosition (for the mover) → downgrade one level */
  lostPosition: 10,
} as const;

export type ClassifyThresholds = { [K in keyof typeof CLASSIFY_THRESHOLDS]: number };

export interface ClassifyInput {
  /** Side that played the move. */
  color: "w" | "b";
  /** Played move in UCI notation (e2e4, e7e8q). */
  playedUci: string;
  /** Engine best move in the position before the move (UCI), if known. */
  bestUci: string | null;
  /** Score of the position before the move (white POV). */
  before: Score;
  /** Score of the position after the move (white POV). */
  after: Score;
  /** Number of legal moves in the position before the move. */
  legalMoves: number;
}

export interface Classification {
  cls: MoveClass;
  /** Win-probability points lost by the mover, ≥ 0. */
  loss: number;
  winBefore: number;
  winAfter: number;
}

// Severity order used for "at most" / "at least" / "downgrade".
const SEVERITY = ["good", "inaccuracy", "mistake", "blunder"] as const;
type Graded = (typeof SEVERITY)[number];

const rank = (c: Graded) => SEVERITY.indexOf(c);
const atMost = (c: Graded, cap: Graded): Graded => (rank(c) > rank(cap) ? cap : c);
const atLeast = (c: Graded, floor: Graded): Graded => (rank(c) < rank(floor) ? floor : c);
const downgrade = (c: Graded): Graded => SEVERITY[Math.max(0, rank(c) - 1)] ?? "good";

export function gradeLoss(loss: number, t: ClassifyThresholds = CLASSIFY_THRESHOLDS): Graded {
  if (loss < t.good) return "good";
  if (loss < t.inaccuracy) return "inaccuracy";
  if (loss < t.mistake) return "mistake";
  return "blunder";
}

export function classifyMove(
  input: ClassifyInput,
  t: ClassifyThresholds = CLASSIFY_THRESHOLDS,
): Classification {
  const { color, before, after } = input;
  const opponent = color === "w" ? "b" : "w";
  const winBefore = winFor(before, color);
  const winAfter = winFor(after, color);
  const loss = Math.max(0, winBefore - winAfter);
  const result = (cls: MoveClass): Classification => ({ cls, loss, winBefore, winAfter });

  // 4. Only one legal move: forced, not counted for accuracy.
  if (input.legalMoves === 1) return result("forced");

  // Playing the engine's move, or delivering mate, is always Best.
  if (input.bestUci !== null && input.playedUci === input.bestUci) return result("best");
  if (after.kind === "result" && isMateFor(after, color)) return result("best");

  const hadMate = isMateFor(before, color);
  const keepsMate = isMateFor(after, color);
  const lostMate = hadMate && !keepsMate;
  const allowsMate = isMateFor(after, opponent) && !isMateFor(before, opponent);

  let cls = gradeLoss(loss, t);

  // 3. Lost position: inaccuracies matter little.
  if (winBefore <= t.lostPosition) cls = downgrade(cls);

  // 1. Still clearly winning (and no forced mate was thrown away).
  if (winAfter >= t.stillWinning && !lostMate) cls = atMost(cls, "good");

  // 2. Mates.
  if (hadMate && keepsMate) cls = atMost(cls, "good");
  if (lostMate) cls = atLeast(cls, "mistake");
  if (allowsMate) cls = "blunder";

  return result(cls);
}
