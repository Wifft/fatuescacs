// Text description of a position for screen readers. Pure; wording lives in messages/es.ts.
import { Chess, type PieceSymbol, type Square } from "chess.js";

export const DESCRIBE_ORDER: readonly PieceSymbol[] = ["k", "q", "r", "b", "n", "p"];

export interface SideDescription {
  /** Squares per piece type, sorted a→h then 1→8 (e.g. { r: ["a1", "f1"] }). */
  pieces: Partial<Record<PieceSymbol, Square[]>>;
}

export interface PositionDescription {
  w: SideDescription;
  b: SideDescription;
  turn: "w" | "b";
  check: boolean;
  checkmate: boolean;
  stalemate: boolean;
}

export function describePosition(fen: string): PositionDescription {
  const g = new Chess(fen);
  const sides: Record<"w" | "b", SideDescription> = { w: { pieces: {} }, b: { pieces: {} } };
  for (const row of g.board()) {
    for (const sq of row) {
      if (!sq) continue;
      (sides[sq.color].pieces[sq.type] ??= []).push(sq.square);
    }
  }
  for (const side of Object.values(sides)) {
    for (const list of Object.values(side.pieces)) list?.sort();
  }
  return {
    ...sides,
    turn: g.turn(),
    check: g.isCheck(),
    checkmate: g.isCheckmate(),
    stalemate: g.isStalemate(),
  };
}

/** "wN" (react-chessboard piece code) → { color: "w", type: "n" }. */
export function parsePieceCode(code: string): { color: "w" | "b"; type: PieceSymbol } | null {
  const m = /^([wb])([KQRBNP])$/.exec(code);
  if (!m) return null;
  return { color: m[1] as "w" | "b", type: (m[2] as string).toLowerCase() as PieceSymbol };
}
