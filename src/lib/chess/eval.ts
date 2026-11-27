// Evaluation helpers. Every score here is from WHITE's point of view.
import { Chess } from "chess.js";

export type GameResult = "1-0" | "0-1" | "1/2-1/2";

/**
 * - `cp`: centipawns, positive = white is better.
 * - `mate`: moves to mate, positive = white mates, negative = black mates (never 0).
 * - `result`: terminal position (checkmate / stalemate / insufficient material).
 */
export type Score =
  | { kind: "cp"; cp: number }
  | { kind: "mate"; mate: number }
  | { kind: "result"; result: GameResult };

export const CP_CEILING = 1000;
const WIN_MULTIPLIER = 0.00368208;

/** Lichess win probability for white in [0, 100] from centipawns (clamped to ±1000). */
export function winFromCp(cp: number): number {
  const c = Math.max(-CP_CEILING, Math.min(CP_CEILING, cp));
  return 50 + 50 * (2 / (1 + Math.exp(-WIN_MULTIPLIER * c)) - 1);
}

/** Win probability for white in [0, 100]. Mates count as certain wins/losses. */
export function winWhite(score: Score): number {
  switch (score.kind) {
    case "cp":
      return winFromCp(score.cp);
    case "mate":
      return score.mate > 0 ? 100 : 0;
    case "result":
      return score.result === "1-0" ? 100 : score.result === "0-1" ? 0 : 50;
  }
}

/** Win probability for the given side in [0, 100]. */
export function winFor(score: Score, color: "w" | "b"): number {
  const w = winWhite(score);
  return color === "w" ? w : 100 - w;
}

/** True when the score is a forced mate (or a delivered checkmate) in favour of `color`. */
export function isMateFor(score: Score, color: "w" | "b"): boolean {
  if (score.kind === "mate") return color === "w" ? score.mate > 0 : score.mate < 0;
  if (score.kind === "result") return score.result === (color === "w" ? "1-0" : "0-1");
  return false;
}

const MINUS = "−";

/** `+1.3`, `−0.4`, `0.0`, `+M3`, `−M2`, `1-0`, `0-1`, `½-½`. */
export function formatScore(score: Score): string {
  switch (score.kind) {
    case "result":
      return score.result === "1/2-1/2" ? "½-½" : score.result;
    case "mate":
      return `${score.mate > 0 ? "+" : MINUS}M${Math.abs(score.mate)}`;
    case "cp": {
      const pawns = Math.abs(score.cp) / 100;
      const text = pawns.toFixed(1);
      if (text === "0.0") return "0.0";
      return `${score.cp > 0 ? "+" : MINUS}${text}`;
    }
  }
}

/**
 * Converts a raw UCI score (side-to-move point of view) to white's point of view.
 * `mate 0` (side to move is mated) is mapped to the corresponding result.
 */
export function normalizeUciScore(
  raw: { type: "cp" | "mate"; value: number },
  sideToMove: "w" | "b",
): Score {
  const sign = sideToMove === "w" ? 1 : -1;
  if (raw.type === "cp") return { kind: "cp", cp: raw.value * sign };
  if (raw.value === 0) return { kind: "result", result: sideToMove === "w" ? "0-1" : "1-0" };
  return { kind: "mate", mate: raw.value * sign };
}

/** Resolves terminal positions without the engine. Returns null if the game goes on. */
export function terminalScore(fen: string): Score | null {
  const g = new Chess(fen);
  if (g.isCheckmate()) return { kind: "result", result: g.turn() === "w" ? "0-1" : "1-0" };
  if (g.isStalemate() || g.isInsufficientMaterial()) return { kind: "result", result: "1/2-1/2" };
  return null;
}
