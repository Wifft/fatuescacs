// PGN → list of positions. Pure, no UI dependencies.
import { Chess, DEFAULT_POSITION } from "chess.js";

export interface GameMove {
  /** Ply number, starting at 1 for the first move of the game. */
  ply: number;
  /** Full-move number as written in the PGN (1. e4 e5 → both 1). */
  moveNumber: number;
  color: "w" | "b";
  san: string;
  uci: string;
  from: string;
  to: string;
  promotion?: string;
  fenBefore: string;
  fenAfter: string;
}

export interface ParsedGame {
  headers: Record<string, string>;
  /** FEN of every position: index 0 is the start, index i is after move i. */
  fens: string[];
  /** Legal-move count of every position (same indexing as `fens`). */
  legalMoves: number[];
  moves: GameMove[];
  startFen: string;
}

export type PgnErrorKind = "empty" | "syntax" | "illegal-move" | "invalid-fen";

export class PgnError extends Error {
  constructor(
    readonly kind: PgnErrorKind,
    message: string,
    /** 1-based line in the input, when known. */
    readonly line?: number,
    /** 1-based column in the input, when known. */
    readonly column?: number,
    /** Offending move text (e.g. "Bxe7"), for illegal moves. */
    readonly moveText?: string,
    /** Full-move number of the offending move, when known. */
    readonly moveNumber?: number,
  ) {
    super(message);
    this.name = "PgnError";
  }
}

// chess.js fills unknown seven-tag-roster headers with "?" placeholders. Drop them.
const PLACEHOLDER = /^[?.]*$/;

export function parsePgn(text: string): ParsedGame {
  if (text.trim() === "") throw new PgnError("empty", "PGN vacío");

  const chess = new Chess();
  try {
    chess.loadPgn(text);
  } catch (err) {
    throw toPgnError(err, text);
  }

  const headers = Object.fromEntries(
    Object.entries(chess.getHeaders()).filter(([, v]) => !PLACEHOLDER.test(v)),
  );
  const history = chess.history({ verbose: true });
  const startFen = history[0]?.before ?? (headers.FEN || chess.fen() || DEFAULT_POSITION);
  // Move numbers come from the start FEN (custom positions may start at move 23 with black).
  const startFull = Number(startFen.split(" ")[5]) || 1;
  const startBlack = startFen.split(" ")[1] === "b";

  const moves: GameMove[] = history.map((m, i) => {
    const plyFromStart = i + (startBlack ? 1 : 0);
    return {
      ply: i + 1,
      moveNumber: startFull + Math.floor(plyFromStart / 2),
      color: m.color,
      san: m.san,
      uci: m.from + m.to + (m.promotion ?? ""),
      from: m.from,
      to: m.to,
      ...(m.promotion ? { promotion: m.promotion } : {}),
      fenBefore: m.before,
      fenAfter: m.after,
    };
  });

  const fens = [startFen, ...moves.map((m) => m.fenAfter)];
  const legalMoves = fens.map((f) => new Chess(f).moves().length);
  return { headers, fens, legalMoves, moves, startFen };
}

function toPgnError(err: unknown, text: string): PgnError {
  const e = err as { message?: string; location?: { start?: { line: number; column: number } } };
  const message = e?.message ?? String(err);

  const illegal = /^Invalid move in PGN: (.+)$/.exec(message);
  if (illegal?.[1]) {
    const moveText = illegal[1].trim();
    const where = locateMove(text, moveText);
    return new PgnError(
      "illegal-move",
      message,
      where?.line,
      where?.column,
      moveText,
      where?.moveNumber,
    );
  }
  if (/fen/i.test(message)) return new PgnError("invalid-fen", message);
  const start = e?.location?.start;
  return new PgnError("syntax", message, start?.line, start?.column);
}

/**
 * Finds the first occurrence of `moveText` as a token in the movetext (outside headers,
 * comments and variations) and the full-move number written before it.
 */
function locateMove(
  text: string,
  moveText: string,
): { line: number; column: number; moveNumber?: number } | null {
  let depth = 0; // variation depth
  let inComment = false;
  let inHeader = false;
  let lastNumber: number | undefined;
  let line = 1;
  let col = 1;
  let i = 0;
  const isSep = (ch: string | undefined) => ch === undefined || /[\s(){}[\];]/.test(ch);

  while (i < text.length) {
    const ch = text[i] as string;
    if (inComment) {
      if (ch === "}") inComment = false;
    } else if (inHeader) {
      if (ch === "]") inHeader = false;
    } else if (ch === "{") inComment = true;
    else if (ch === "[") inHeader = true;
    else if (ch === "(") depth++;
    else if (ch === ")") depth = Math.max(0, depth - 1);
    else if (depth === 0 && !isSep(ch) && isSep(text[i - 1])) {
      // Start of a token.
      let j = i;
      while (j < text.length && !isSep(text[j])) j++;
      const token = text.slice(i, j);
      const num = /^(\d+)\.+(.*)$/.exec(token);
      const san = num ? num[2] : token;
      if (num) lastNumber = Number(num[1]);
      if (san === moveText) {
        const offset = num ? token.length - (num[2]?.length ?? 0) : 0;
        return { line, column: col + offset, moveNumber: lastNumber };
      }
      col += j - i;
      i = j;
      continue;
    }
    if (ch === "\n") {
      line++;
      col = 1;
    } else col++;
    i++;
  }
  return null;
}
