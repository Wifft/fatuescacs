// Training drills: the user's mistakes and blunders, reviewed with a simple Leitner system.
// Server-only module.
import type { Db } from "./db";

const DAY_MS = 86_400_000;
/** Days until the next review once a drill reaches box 1, 2, 3, 4, 5. */
export const BOX_INTERVAL_DAYS = [1, 3, 7, 14, 30] as const;
export const MAX_BOX = BOX_INTERVAL_DAYS.length;

export interface DrillCandidate {
  ply: number;
  fen: string;
  playedUci: string;
  bestUci: string;
  bestPv: string[];
  cls: "mistake" | "blunder";
  loss: number;
}

export interface Drill {
  id: number;
  analysisId: number;
  ply: number;
  fen: string;
  playedUci: string;
  bestUci: string;
  bestPv: string[];
  cls: string;
  loss: number;
  box: number;
  dueAt: number;
  reviews: number;
  lastCorrect: boolean | null;
  white: string | null;
  black: string | null;
}

/**
 * Makes the analysis' drills match `candidates`: new ones are due now, existing ones keep their
 * progress (box, due date), and moves that are no longer mistakes are dropped.
 */
export function syncDrills(
  db: Db,
  userId: number,
  analysisId: number,
  candidates: readonly DrillCandidate[],
  now: number,
): void {
  const plies = candidates.map((c) => c.ply);
  db.prepare(
    `DELETE FROM drills WHERE analysis_id = ? AND user_id = ?
     AND ply NOT IN (SELECT value FROM json_each(?))`,
  ).run(analysisId, userId, JSON.stringify(plies));
  const upsert = db.prepare(
    `INSERT INTO drills (user_id, analysis_id, ply, fen, played_uci, best_uci, best_pv, cls, loss, due_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (analysis_id, ply) DO UPDATE SET
       fen = excluded.fen, played_uci = excluded.played_uci, best_uci = excluded.best_uci,
       best_pv = excluded.best_pv, cls = excluded.cls, loss = excluded.loss`,
  );
  for (const c of candidates) {
    upsert.run(
      userId,
      analysisId,
      c.ply,
      c.fen,
      c.playedUci,
      c.bestUci,
      JSON.stringify(c.bestPv.slice(0, 10)),
      c.cls,
      c.loss,
      now,
    );
  }
}

interface DrillRow {
  id: number;
  analysis_id: number;
  ply: number;
  fen: string;
  played_uci: string;
  best_uci: string;
  best_pv: string;
  cls: string;
  loss: number;
  box: number;
  due_at: number;
  reviews: number;
  last_correct: number | null;
  white: string | null;
  black: string | null;
}

const toDrill = (r: DrillRow): Drill => ({
  id: r.id,
  analysisId: r.analysis_id,
  ply: r.ply,
  fen: r.fen,
  playedUci: r.played_uci,
  bestUci: r.best_uci,
  bestPv: JSON.parse(r.best_pv) as string[],
  cls: r.cls,
  loss: r.loss,
  box: r.box,
  dueAt: r.due_at,
  reviews: r.reviews,
  lastCorrect: r.last_correct === null ? null : r.last_correct === 1,
  white: r.white,
  black: r.black,
});

const SELECT = `SELECT d.*, a.white, a.black FROM drills d JOIN analyses a ON a.id = d.analysis_id`;

/** Drills due now (oldest first, blunders before mistakes), plus counters. */
export function dueDrills(db: Db, userId: number, now = Date.now(), limit = 20) {
  const rows = db
    .prepare(
      `${SELECT} WHERE d.user_id = ? AND d.due_at <= ?
       ORDER BY d.due_at ASC, d.cls = 'blunder' DESC, d.id ASC LIMIT ?`,
    )
    .all(userId, now, limit) as unknown as DrillRow[];
  const counts = db
    .prepare(
      `SELECT COUNT(*) AS total, SUM(due_at <= ?) AS due, MIN(CASE WHEN due_at > ? THEN due_at END) AS next
       FROM drills WHERE user_id = ?`,
    )
    .get(now, now, userId) as { total: number; due: number | null; next: number | null };
  return {
    drills: rows.map(toDrill),
    total: counts.total,
    due: counts.due ?? 0,
    nextDueAt: counts.next,
  };
}

/**
 * Records an answer. Correct: up one box (max 5), next review after that box's interval.
 * Wrong: back to box 1 (review tomorrow).
 */
export function answerDrill(
  db: Db,
  userId: number,
  drillId: number,
  correct: boolean,
  now = Date.now(),
): Drill | null {
  const row = db
    .prepare("SELECT box FROM drills WHERE id = ? AND user_id = ?")
    .get(drillId, userId) as { box: number } | undefined;
  if (!row) return null;
  const box = correct ? Math.min(MAX_BOX, row.box + 1) : 1;
  const dueAt = now + (BOX_INTERVAL_DAYS[box - 1] ?? 1) * DAY_MS;
  db.prepare(
    `UPDATE drills SET box = ?, due_at = ?, reviews = reviews + 1, last_correct = ?
     WHERE id = ? AND user_id = ?`,
  ).run(box, dueAt, correct ? 1 : 0, drillId, userId);
  const updated = db.prepare(`${SELECT} WHERE d.id = ?`).get(drillId) as unknown as DrillRow;
  return toDrill(updated);
}
