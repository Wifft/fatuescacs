// Saved analyses. Every query is scoped to the owner. Server-only module.
import { createHash } from "node:crypto";
import type { Score } from "@/lib/chess/eval";
import { parsePgn } from "@/lib/chess/pgn";
import { buildReport } from "@/lib/chess/report";
import type { PositionEval } from "@/lib/engine/uci";
import type { Db } from "./db";

export const MAX_PGN_BYTES = 100_000;
export const MAX_EVALS_BYTES = 1_000_000;
const MAX_TEXT = 200;

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export interface SaveAnalysisInput {
  pgn: string;
  depth: number;
  evals: PositionEval[];
  bookPlies?: number;
  opening?: { eco: string; name: string } | null;
}

export interface AnalysisSummary {
  id: number;
  white: string | null;
  black: string | null;
  event: string | null;
  date: string | null;
  result: string | null;
  opening: { eco: string; name: string } | null;
  depth: number;
  accuracy: { w: number | null; b: number | null };
  counts: { w: Record<string, number>; b: Record<string, number> };
  updatedAt: number;
}

export interface AnalysisDetail extends AnalysisSummary {
  pgn: string;
  evals: PositionEval[];
  bookPlies: number;
}

const isInt = (x: unknown): x is number => typeof x === "number" && Number.isInteger(x);
const isStr = (x: unknown, max = MAX_TEXT): x is string => typeof x === "string" && x.length <= max;
const UCI = /^[a-h][1-8][a-h][1-8][qrbn]?$/;

function validScore(s: unknown): s is Score {
  if (!s || typeof s !== "object") return false;
  const o = s as Record<string, unknown>;
  if (o.kind === "cp") return typeof o.cp === "number" && Number.isFinite(o.cp);
  if (o.kind === "mate") return isInt(o.mate) && o.mate !== 0;
  if (o.kind === "result")
    return o.result === "1-0" || o.result === "0-1" || o.result === "1/2-1/2";
  return false;
}

function validEval(e: unknown): PositionEval {
  if (!e || typeof e !== "object") throw new ValidationError("eval");
  const o = e as Record<string, unknown>;
  if (!validScore(o.score)) throw new ValidationError("score");
  if (!(o.best === null || (typeof o.best === "string" && UCI.test(o.best)))) {
    throw new ValidationError("best");
  }
  if (
    !Array.isArray(o.pv) ||
    o.pv.length > 40 ||
    !o.pv.every((m) => typeof m === "string" && UCI.test(m))
  ) {
    throw new ValidationError("pv");
  }
  if (!isInt(o.depth) || o.depth < 0 || o.depth > 99) throw new ValidationError("depth");
  return { score: o.score, best: o.best, pv: o.pv as string[], depth: o.depth };
}

/** Validates untrusted input and recomputes the summary on the server. */
export function prepareAnalysis(body: unknown) {
  if (!body || typeof body !== "object") throw new ValidationError("body");
  const b = body as Record<string, unknown>;
  if (typeof b.pgn !== "string" || Buffer.byteLength(b.pgn) > MAX_PGN_BYTES) {
    throw new ValidationError("pgn");
  }
  if (!isInt(b.depth) || b.depth < 1 || b.depth > 40) throw new ValidationError("depth");
  if (!Array.isArray(b.evals)) throw new ValidationError("evals");

  let game;
  try {
    game = parsePgn(b.pgn);
  } catch {
    throw new ValidationError("pgn");
  }
  if (b.evals.length !== game.fens.length) throw new ValidationError("evals-length");
  const evals = b.evals.map(validEval);

  const bookPlies = b.bookPlies === undefined ? 0 : b.bookPlies;
  if (!isInt(bookPlies) || bookPlies < 0 || bookPlies > game.moves.length) {
    throw new ValidationError("bookPlies");
  }
  let opening: { eco: string; name: string } | null = null;
  if (b.opening != null) {
    const o = b.opening as Record<string, unknown>;
    if (!isStr(o.eco, 10) || !isStr(o.name)) throw new ValidationError("opening");
    opening = { eco: o.eco, name: o.name };
  }

  const report = buildReport(game.moves, game.legalMoves, evals, { bookPlies });
  const h = game.headers;
  const clip = (s: string | undefined) => (s ? s.slice(0, MAX_TEXT) : null);
  return {
    pgn: b.pgn.trim(),
    depth: b.depth,
    bookPlies,
    evals,
    opening,
    white: clip(h.White),
    black: clip(h.Black),
    event: clip(h.Event),
    date: clip(h.Date),
    result: clip(h.Result),
    accuracy: report.accuracy ?? { w: null, b: null },
    counts: report.counts,
  };
}

export function saveAnalysis(db: Db, userId: number, body: unknown, now = Date.now()): number {
  const a = prepareAnalysis(body);
  const evalsJson = JSON.stringify(a.evals);
  if (Buffer.byteLength(evalsJson) > MAX_EVALS_BYTES) throw new ValidationError("evals-size");
  const pgnHash = createHash("sha256").update(a.pgn).digest("hex");
  const row = db
    .prepare(
      `INSERT INTO analyses (user_id, pgn_hash, pgn, white, black, event, game_date, result,
         opening_eco, opening_name, depth, book_plies, accuracy_w, accuracy_b, counts, evals,
         created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (user_id, pgn_hash) DO UPDATE SET
         depth = excluded.depth, book_plies = excluded.book_plies,
         opening_eco = excluded.opening_eco, opening_name = excluded.opening_name,
         accuracy_w = excluded.accuracy_w, accuracy_b = excluded.accuracy_b,
         counts = excluded.counts, evals = excluded.evals, updated_at = excluded.updated_at
       RETURNING id`,
    )
    .get(
      userId,
      pgnHash,
      a.pgn,
      a.white,
      a.black,
      a.event,
      a.date,
      a.result,
      a.opening?.eco ?? null,
      a.opening?.name ?? null,
      a.depth,
      a.bookPlies,
      a.accuracy.w,
      a.accuracy.b,
      JSON.stringify(a.counts),
      evalsJson,
      now,
      now,
    ) as { id: number };
  return row.id;
}

interface Row {
  id: number;
  pgn: string;
  white: string | null;
  black: string | null;
  event: string | null;
  game_date: string | null;
  result: string | null;
  opening_eco: string | null;
  opening_name: string | null;
  depth: number;
  book_plies: number;
  accuracy_w: number | null;
  accuracy_b: number | null;
  counts: string;
  evals: string;
  updated_at: number;
}

function summary(r: Row): AnalysisSummary {
  return {
    id: r.id,
    white: r.white,
    black: r.black,
    event: r.event,
    date: r.game_date,
    result: r.result,
    opening: r.opening_eco && r.opening_name ? { eco: r.opening_eco, name: r.opening_name } : null,
    depth: r.depth,
    accuracy: { w: r.accuracy_w, b: r.accuracy_b },
    counts: JSON.parse(r.counts) as AnalysisSummary["counts"],
    updatedAt: r.updated_at,
  };
}

export function listAnalyses(db: Db, userId: number, limit = 100): AnalysisSummary[] {
  const rows = db
    .prepare(
      `SELECT id, pgn, white, black, event, game_date, result, opening_eco, opening_name, depth,
         book_plies, accuracy_w, accuracy_b, counts, '[]' AS evals, updated_at
       FROM analyses WHERE user_id = ? ORDER BY updated_at DESC, id DESC LIMIT ?`,
    )
    .all(userId, limit) as unknown as Row[];
  return rows.map(summary);
}

export function getAnalysis(db: Db, userId: number, id: number): AnalysisDetail | null {
  const r = db
    .prepare("SELECT * FROM analyses WHERE id = ? AND user_id = ?")
    .get(id, userId) as unknown as Row | undefined;
  if (!r) return null;
  return {
    ...summary(r),
    pgn: r.pgn,
    evals: JSON.parse(r.evals) as PositionEval[],
    bookPlies: r.book_plies,
  };
}

export function deleteAnalysis(db: Db, userId: number, id: number): boolean {
  return (
    db.prepare("DELETE FROM analyses WHERE id = ? AND user_id = ?").run(id, userId).changes > 0
  );
}
