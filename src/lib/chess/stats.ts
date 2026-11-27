// Aggregate statistics over the user's saved games. Pure.
//
// Game phase heuristic (by material, documented in CLAUDE.md):
//   non-pawn material = Q 9, R 5, B 3, N 3 for both sides together (62 at the start).
//   - opening:    fewer than 20 plies played and non-pawn material ≥ 52;
//   - endgame:    non-pawn material ≤ 26;
//   - middlegame: everything else.
// The phase of a move is the phase of the position it was played from.
// Phase accuracy is the simple mean of the user's per-move accuracies (forced and book moves
// excluded), across all games.
import { moveAccuracy } from "./accuracy";
import { explainMove, type Explanation } from "./explain";
import { parsePgn } from "./pgn";
import { buildReport } from "./report";
import type { PositionEval } from "../engine/uci";

export type GamePhase = "opening" | "middlegame" | "endgame";
export const PHASES: readonly GamePhase[] = ["opening", "middlegame", "endgame"];

export const PHASE_RULES = {
  openingMaxPlies: 20,
  openingMinMaterial: 52,
  endgameMaxMaterial: 26,
} as const;

const VALUES: Record<string, number> = { q: 9, r: 5, b: 3, n: 3 };

/** Non-pawn material of both sides (kings and pawns excluded). */
export function nonPawnMaterial(fen: string): number {
  let total = 0;
  for (const ch of fen.split(" ")[0] ?? "") total += VALUES[ch.toLowerCase()] ?? 0;
  return total;
}

/** @param pliesPlayed plies played before this position (0 at the start of the game). */
export function phaseOf(fen: string, pliesPlayed: number): GamePhase {
  const m = nonPawnMaterial(fen);
  if (m <= PHASE_RULES.endgameMaxMaterial) return "endgame";
  if (pliesPlayed < PHASE_RULES.openingMaxPlies && m >= PHASE_RULES.openingMinMaterial) {
    return "opening";
  }
  return "middlegame";
}

/** Piece that moved, from SAN: "k" for castling, "p" for pawn moves. */
export function movedPiece(san: string): "k" | "q" | "r" | "b" | "n" | "p" {
  if (san.startsWith("O-O")) return "k";
  const c = san[0];
  return c === "K"
    ? "k"
    : c === "Q"
      ? "q"
      : c === "R"
        ? "r"
        : c === "B"
          ? "b"
          : c === "N"
            ? "n"
            : "p";
}

export interface StatsGame {
  pgn: string;
  evals: PositionEval[];
  bookPlies: number;
  userColor: "w" | "b";
  opening: { eco: string; name: string } | null;
  result: string | null;
}

export interface PhaseStats {
  moves: number;
  accuracy: number | null;
  inaccuracy: number;
  mistake: number;
  blunder: number;
}

export interface OpeningStats {
  eco: string | null;
  name: string | null;
  games: number;
  wins: number;
  draws: number;
  losses: number;
  /** Points per game for the user, 0–1 (null if no finished game). */
  score: number | null;
  accuracy: number | null;
}

export type ErrorKind = Explanation["kind"];

export interface Stats {
  games: number;
  moves: number;
  phases: Record<GamePhase, PhaseStats>;
  /** Worst first: lowest score, then lowest accuracy. */
  openings: OpeningStats[];
  /** Mistakes and blunders (not inaccuracies). */
  errors: {
    total: number;
    byPhase: Record<GamePhase, number>;
    byPiece: Record<"k" | "q" | "r" | "b" | "n" | "p", number>;
    byKind: Partial<Record<ErrorKind, number>>;
  };
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);

export function computeStats(games: readonly StatsGame[]): Stats {
  const phaseAcc: Record<GamePhase, number[]> = { opening: [], middlegame: [], endgame: [] };
  const phases = Object.fromEntries(
    PHASES.map((p) => [p, { moves: 0, accuracy: null, inaccuracy: 0, mistake: 0, blunder: 0 }]),
  ) as Record<GamePhase, PhaseStats>;
  const errors: Stats["errors"] = {
    total: 0,
    byPhase: { opening: 0, middlegame: 0, endgame: 0 },
    byPiece: { k: 0, q: 0, r: 0, b: 0, n: 0, p: 0 },
    byKind: {},
  };
  const openings = new Map<string, OpeningStats & { acc: number[] }>();
  let moves = 0;
  let counted = 0;

  for (const g of games) {
    let game;
    try {
      game = parsePgn(g.pgn);
    } catch {
      continue;
    }
    if (g.evals.length !== game.fens.length) continue;
    counted++;
    const report = buildReport(game.moves, game.legalMoves, g.evals, { bookPlies: g.bookPlies });
    const gameAcc: number[] = [];

    game.moves.forEach((m, i) => {
      const c = report.classes[i];
      if (m.color !== g.userColor || !c) return;
      const phase = phaseOf(m.fenBefore, i);
      if (c.cls === "forced" || c.cls === "book") return;
      moves++;
      const acc = moveAccuracy(c.loss);
      phaseAcc[phase].push(acc);
      gameAcc.push(acc);
      phases[phase].moves++;
      if (c.cls === "inaccuracy" || c.cls === "mistake" || c.cls === "blunder")
        phases[phase][c.cls]++;
      if (c.cls === "mistake" || c.cls === "blunder") {
        errors.total++;
        errors.byPhase[phase]++;
        errors.byPiece[movedPiece(m.san)]++;
        const e = explainMove({
          fenBefore: m.fenBefore,
          playedUci: m.uci,
          before: g.evals[i]!,
          after: g.evals[i + 1]!,
          classification: c,
        });
        if (e) errors.byKind[e.kind] = (errors.byKind[e.kind] ?? 0) + 1;
      }
    });

    const key = g.opening ? `${g.opening.eco}|${g.opening.name}` : "";
    const o = openings.get(key) ?? {
      eco: g.opening?.eco ?? null,
      name: g.opening?.name ?? null,
      games: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      score: null,
      accuracy: null,
      acc: [],
    };
    o.games++;
    const win = g.userColor === "w" ? "1-0" : "0-1";
    const loss = g.userColor === "w" ? "0-1" : "1-0";
    if (g.result === win) o.wins++;
    else if (g.result === loss) o.losses++;
    else if (g.result === "1/2-1/2") o.draws++;
    const gameMean = mean(gameAcc);
    if (gameMean !== null) o.acc.push(gameMean);
    openings.set(key, o);
  }

  for (const p of PHASES) phases[p].accuracy = mean(phaseAcc[p]);
  const openingList = [...openings.values()].map(({ acc, ...o }) => {
    const finished = o.wins + o.draws + o.losses;
    return {
      ...o,
      score: finished ? (o.wins + o.draws / 2) / finished : null,
      accuracy: mean(acc),
    };
  });
  openingList.sort(
    (a, b) =>
      (a.score ?? 2) - (b.score ?? 2) ||
      (a.accuracy ?? 101) - (b.accuracy ?? 101) ||
      b.games - a.games,
  );

  return { games: counted, moves, phases, openings: openingList, errors };
}
