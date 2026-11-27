"use client";

import { useMemo } from "react";
import { buildReport, type GameReport } from "@/lib/chess/report";
import { useAnalysis } from "./analysis";

const EMPTY: GameReport = {
  classes: [],
  accuracy: null,
  counts: {
    w: { inaccuracy: 0, mistake: 0, blunder: 0 },
    b: { inaccuracy: 0, mistake: 0, blunder: 0 },
  },
};

/** Report derived from the current evaluations (recomputed only when they change). */
export function useReport(): GameReport {
  const game = useAnalysis((s) => s.game);
  const evals = useAnalysis((s) => s.evals);
  const bookPlies = useAnalysis((s) => s.opening?.bookPlies ?? 0);
  return useMemo(
    () => (game ? buildReport(game.moves, game.legalMoves, evals, { bookPlies }) : EMPTY),
    [game, evals, bookPlies],
  );
}
