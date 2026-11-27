"use client";

import { create } from "zustand";
import type { Notation } from "@/lib/chess/notation";
import type { ParsedGame } from "@/lib/chess/pgn";
import type { AnalysisMetrics, AnalysisProgress } from "@/lib/engine/analyzer";
import type { EngineBuild } from "@/lib/engine/boot";
import type { PositionEval } from "@/lib/engine/uci";

export const DEPTH_OPTIONS = [12, 16, 20] as const;
export const DEFAULT_DEPTH = 16;

export type EngineStatus = "idle" | "loading" | "ready" | "error";

export interface EngineInfo {
  name: string;
  build: EngineBuild;
  loadMs: number;
}

export interface AnalysisState {
  game: ParsedGame | null;
  /** evals[i] evaluates game.fens[i]; refined in place by the second pass. */
  evals: (PositionEval | null)[];
  ply: number;
  orientation: "white" | "black";
  notation: Notation;
  depth: number;
  engineStatus: EngineStatus;
  engine: EngineInfo | null;
  progress: AnalysisProgress | null;
  metrics: AnalysisMetrics | null;

  setGame(game: ParsedGame): void;
  setEval(index: number, e: PositionEval): void;
  goTo(ply: number): void;
  step(delta: number): void;
  flip(): void;
  setNotation(n: Notation): void;
  setDepth(d: number): void;
  setEngine(status: EngineStatus, info?: EngineInfo | null): void;
  setProgress(p: AnalysisProgress | null): void;
  setMetrics(m: AnalysisMetrics | null): void;
}

const NOTATION_KEY = "notation";
const DEPTH_KEY = "depth";

function readPref<T>(
  key: string,
  valid: (v: string) => boolean,
  parse: (v: string) => T,
  fallback: T,
): T {
  try {
    const v = globalThis.localStorage?.getItem(key);
    return v !== null && v !== undefined && valid(v) ? parse(v) : fallback;
  } catch {
    return fallback;
  }
}
function writePref(key: string, value: string) {
  try {
    globalThis.localStorage?.setItem(key, value);
  } catch {
    /* storage unavailable: preference just isn't remembered */
  }
}

export const useAnalysis = create<AnalysisState>()((set, get) => ({
  game: null,
  evals: [],
  ply: 0,
  orientation: "white",
  notation: "es",
  depth: DEFAULT_DEPTH,
  engineStatus: "idle",
  engine: null,
  progress: null,
  metrics: null,

  setGame: (game) =>
    set({
      game,
      evals: Array.from({ length: game.fens.length }, () => null),
      ply: 0,
      progress: null,
      metrics: null,
    }),
  setEval: (index, e) =>
    set((s) => {
      if (index < 0 || index >= s.evals.length) return s;
      const evals = s.evals.slice();
      evals[index] = e;
      return { evals };
    }),
  goTo: (ply) => {
    const n = get().game?.fens.length ?? 1;
    set({ ply: Math.max(0, Math.min(n - 1, ply)) });
  },
  step: (delta) => get().goTo(get().ply + delta),
  flip: () => set((s) => ({ orientation: s.orientation === "white" ? "black" : "white" })),
  setNotation: (notation) => {
    writePref(NOTATION_KEY, notation);
    set({ notation });
  },
  setDepth: (depth) => {
    writePref(DEPTH_KEY, String(depth));
    set({ depth });
  },
  setEngine: (engineStatus, info) =>
    set((s) => ({ engineStatus, engine: info === undefined ? s.engine : info })),
  setProgress: (progress) => set({ progress }),
  setMetrics: (metrics) => set({ metrics }),
}));

/** Loads per-viewer preferences (notation, depth). Call once on the client. */
export function hydratePreferences() {
  const notation = readPref<Notation>(
    NOTATION_KEY,
    (v) => v === "es" || v === "en",
    (v) => v as Notation,
    "es",
  );
  const depth = readPref(
    DEPTH_KEY,
    (v) => (DEPTH_OPTIONS as readonly number[]).includes(Number(v)),
    Number,
    DEFAULT_DEPTH,
  );
  useAnalysis.setState({ notation, depth });
}
