// Pure helpers for parsing UCI output lines. No DOM / Worker dependencies.
import { normalizeUciScore, type Score } from "../chess/eval";

/** Normalises a raw worker message into a trimmed line. */
export function toLine(data: unknown): string {
  return String(data).trim();
}

export function isUciOk(line: string): boolean {
  return line === "uciok";
}

export function isReadyOk(line: string): boolean {
  return line === "readyok";
}

/** Returns the engine name from an `id name <name>` line, or null for any other line. */
export function parseIdName(line: string): string | null {
  const m = /^id name (.+)$/.exec(line);
  return m?.[1]?.trim() || null;
}

export interface UciInfo {
  depth: number;
  multipv: number;
  /** Raw score, side-to-move point of view. */
  score: { type: "cp" | "mate"; value: number; bound?: "lower" | "upper" };
  nodes?: number;
  nps?: number;
  timeMs?: number;
  pv: string[];
}

/**
 * Parses an `info ...` line that carries a score and a principal variation.
 * Returns null for any other line (`info string`, `info currmove`, `info depth 0`, …).
 */
export function parseInfo(line: string): UciInfo | null {
  if (!line.startsWith("info ")) return null;
  const tokens = line.split(/\s+/);
  let depth: number | undefined;
  let multipv = 1;
  let score: UciInfo["score"] | undefined;
  let nodes: number | undefined;
  let nps: number | undefined;
  let timeMs: number | undefined;
  let pv: string[] = [];

  for (let i = 1; i < tokens.length; i++) {
    const t = tokens[i];
    const next = tokens[i + 1];
    switch (t) {
      case "string":
        return null;
      case "depth":
        depth = Number(next);
        i++;
        break;
      case "multipv":
        multipv = Number(next);
        i++;
        break;
      case "nodes":
        nodes = Number(next);
        i++;
        break;
      case "nps":
        nps = Number(next);
        i++;
        break;
      case "time":
        timeMs = Number(next);
        i++;
        break;
      case "score": {
        const type = next;
        const value = Number(tokens[i + 2]);
        if ((type !== "cp" && type !== "mate") || !Number.isFinite(value)) return null;
        score = { type, value };
        i += 2;
        const bound = tokens[i + 1];
        if (bound === "lowerbound" || bound === "upperbound") {
          score.bound = bound === "lowerbound" ? "lower" : "upper";
          i++;
        }
        break;
      }
      case "pv":
        pv = tokens.slice(i + 1).filter(Boolean);
        i = tokens.length;
        break;
    }
  }
  if (depth === undefined || !Number.isFinite(depth) || !score || pv.length === 0) return null;
  return {
    depth,
    multipv,
    score,
    pv,
    ...(nodes !== undefined ? { nodes } : {}),
    ...(nps !== undefined ? { nps } : {}),
    ...(timeMs !== undefined ? { timeMs } : {}),
  };
}

/** Parses `bestmove e2e4 [ponder e7e5]`. `bestmove (none)` → { best: null }. */
export function parseBestMove(line: string): { best: string | null; ponder?: string } | null {
  const m = /^bestmove\s+(\S+)(?:\s+ponder\s+(\S+))?/.exec(line);
  if (!m?.[1]) return null;
  const best = m[1] === "(none)" || m[1] === "0000" ? null : m[1];
  return m[2] ? { best, ponder: m[2] } : { best };
}

/** Engine evaluation of one position, already normalised to WHITE's point of view. */
export interface PositionEval {
  score: Score;
  /** Best move (UCI), null for terminal positions. */
  best: string | null;
  /** Principal variation (UCI), starting with `best`. */
  pv: string[];
  depth: number;
  nps?: number;
}

/** Builds a white-POV evaluation from the last main-line info and the bestmove. */
export function toPositionEval(
  info: UciInfo | null,
  bestmove: { best: string | null },
  sideToMove: "w" | "b",
): PositionEval {
  if (!info) {
    return { score: { kind: "cp", cp: 0 }, best: bestmove.best, pv: [], depth: 0 };
  }
  const pv = info.pv[0] === bestmove.best || !bestmove.best ? info.pv : [bestmove.best];
  return {
    score: normalizeUciScore(info.score, sideToMove),
    best: bestmove.best,
    pv,
    depth: info.depth,
    ...(info.nps !== undefined ? { nps: info.nps } : {}),
  };
}
