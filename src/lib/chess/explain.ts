// Rule-based explanations of mistakes, built only from the engine's own lines (no AI, no guessing).
// Pure: returns structured data; the Spanish text lives in src/messages/es.ts.
import { Chess, type Move, type PieceSymbol } from "chess.js";
import type { Classification } from "./classify";
import type { Score } from "./eval";

export const PIECE_VALUE: Record<PieceSymbol, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
/** Longest stretch of an engine line we replay to measure material. */
const MAX_LINE_PLIES = 6;
/** Material swings smaller than this (in pawns) are not called "losing material". */
const MATERIAL_THRESHOLD = 2;

export type PieceCounts = Partial<Record<PieceSymbol, number>>;

/**
 * Every SAN list comes with the FEN it starts from (`fen`), so the UI can number it and
 * translate it to the viewer's notation.
 */
export type Explanation =
  /** The move lets the opponent force mate. */
  | { kind: "allows-mate"; mateIn: number; fen: string; line: string[] }
  /** There was a forced mate and the move threw it away. */
  | { kind: "lost-mate"; mateIn: number; fen: string; best: string }
  /** The opponent's first reply wins a piece (it may have been attacked already). */
  | {
      kind: "hanging";
      piece: PieceSymbol;
      square: string;
      fen: string;
      capture: string;
      balance: number;
    }
  /** The opponent's best line wins material. */
  | {
      kind: "loses-material";
      fen: string;
      line: string[];
      lost: PieceCounts;
      gained: PieceCounts;
      balance: number;
    }
  /** The best move won material (or promoted) and was missed. */
  | {
      kind: "missed-tactic";
      fen: string;
      best: string;
      line: string[];
      gain: number;
      won: PieceCounts;
    }
  /** Nothing tactical to point at: the evaluation just got worse. */
  | { kind: "eval-swing"; fen: string; best: string; before: Score; after: Score };

export interface ExplainInput {
  fenBefore: string;
  playedUci: string;
  /** Engine data for the position before the move (best move + main line). */
  before: { score: Score; best: string | null; pv: readonly string[] };
  /** Engine data for the position after the move: its pv is the opponent's refutation. */
  after: { score: Score; pv: readonly string[] };
  classification: Pick<Classification, "cls" | "reason">;
}

const EXPLAINED = new Set(["inaccuracy", "mistake", "blunder"]);

function playUci(g: Chess, uci: string): Move | null {
  try {
    return g.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
  } catch {
    return null;
  }
}

function counts(g: Chess, color: "w" | "b"): Record<PieceSymbol, number> {
  const c: Record<PieceSymbol, number> = { p: 0, n: 0, b: 0, r: 0, q: 0, k: 0 };
  for (const row of g.board()) for (const sq of row) if (sq && sq.color === color) c[sq.type]++;
  return c;
}

const materialOf = (c: Record<PieceSymbol, number>) =>
  (Object.keys(c) as PieceSymbol[]).reduce((s, p) => s + c[p] * PIECE_VALUE[p], 0);

function diff(a: Record<PieceSymbol, number>, b: Record<PieceSymbol, number>): PieceCounts {
  const out: PieceCounts = {};
  for (const p of Object.keys(a) as PieceSymbol[]) if (a[p] > b[p]) out[p] = a[p] - b[p];
  return out;
}

/**
 * Replays `uci` from `fen` through the "forcing" part of the line: every capture, check or
 * promotion, stopping before the first quiet move (but always at least `minPlies`).
 * Returns the SAN played and the material balance change for `color`, in pawns.
 */
export function forcingLine(
  fen: string,
  uci: readonly string[],
  color: "w" | "b",
  minPlies = 1,
): { san: string[]; balance: number; lost: PieceCounts; gained: PieceCounts } {
  const g = new Chess(fen);
  const them = color === "w" ? "b" : "w";
  const mine0 = counts(g, color);
  const theirs0 = counts(g, them);
  const san: string[] = [];
  for (const u of uci.slice(0, MAX_LINE_PLIES)) {
    const probe = new Chess(g.fen());
    const m = playUci(probe, u);
    if (!m) break;
    const forcing = m.isCapture() || m.isPromotion() || m.san.includes("+") || m.san.includes("#");
    if (!forcing && san.length >= minPlies) break;
    playUci(g, u);
    san.push(m.san);
  }
  const mine1 = counts(g, color);
  const theirs1 = counts(g, them);
  const balance =
    materialOf(mine1) - materialOf(mine0) - (materialOf(theirs1) - materialOf(theirs0));
  return { san, balance, lost: diff(mine0, mine1), gained: diff(theirs0, theirs1) };
}

export function explainMove(input: ExplainInput): Explanation | null {
  const { cls, reason } = input.classification;
  if (!EXPLAINED.has(cls)) return null;
  const color = input.fenBefore.split(" ")[1] === "b" ? "b" : "w";
  const opponent = color === "w" ? "b" : "w";

  const g = new Chess(input.fenBefore);
  const played = playUci(g, input.playedUci);
  if (!played) return null;
  const fenAfter = g.fen();
  const bestSan = input.before.best
    ? (playUci(new Chess(input.fenBefore), input.before.best)?.san ?? null)
    : null;

  // 1. Allows a forced mate.
  if (reason === "allows-mate") {
    const mateIn = input.after.score.kind === "mate" ? Math.abs(input.after.score.mate) : 1;
    const line = forcingLine(fenAfter, input.after.pv, opponent, mateIn * 2 - 1).san;
    return { kind: "allows-mate", mateIn, fen: fenAfter, line };
  }

  // 2. Throws away a forced mate.
  if (reason === "lost-mate" && input.before.score.kind === "mate" && bestSan) {
    return {
      kind: "lost-mate",
      mateIn: Math.abs(input.before.score.mate),
      fen: input.fenBefore,
      best: bestSan,
    };
  }

  // 3–4. The opponent's reply wins material. Measured from before our move, so a capture we
  // just made (e.g. a bad trade) is counted too.
  const refutation = forcingLine(input.fenBefore, [input.playedUci, ...input.after.pv], color, 2);
  if (refutation.balance <= -MATERIAL_THRESHOLD) {
    const reply = new Chess(fenAfter);
    const first = input.after.pv[0] ? playUci(reply, input.after.pv[0]) : null;
    if (
      first?.captured &&
      PIECE_VALUE[first.captured] >= 3 &&
      -refutation.balance >= PIECE_VALUE[first.captured] - 1
    ) {
      return {
        kind: "hanging",
        piece: first.captured,
        square: first.to,
        fen: fenAfter,
        capture: first.san,
        balance: refutation.balance,
      };
    }
    return {
      kind: "loses-material",
      fen: fenAfter,
      line: refutation.san.slice(1),
      lost: refutation.lost,
      gained: refutation.gained,
      balance: refutation.balance,
    };
  }

  // 5. The best move won material and was missed.
  if (input.before.best && bestSan) {
    const best = forcingLine(
      input.fenBefore,
      input.before.pv.length ? input.before.pv : [input.before.best],
      color,
      1,
    );
    if (best.balance >= MATERIAL_THRESHOLD && best.balance > refutation.balance) {
      return {
        kind: "missed-tactic",
        fen: input.fenBefore,
        best: bestSan,
        line: best.san,
        gain: best.balance,
        won: best.gained,
      };
    }
  }

  // 6. Positional: just describe the evaluation change.
  if (!bestSan) return null;
  return {
    kind: "eval-swing",
    fen: input.fenBefore,
    best: bestSan,
    before: input.before.score,
    after: input.after.score,
  };
}
