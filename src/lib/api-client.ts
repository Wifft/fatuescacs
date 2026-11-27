// Browser client for our own API (same origin; the session travels in an httpOnly cookie).
import type { PositionEval } from "./engine/uci";

export interface ApiUser {
  id: number;
  username: string;
}

export interface SavedAnalysisSummary {
  id: number;
  white: string | null;
  black: string | null;
  event: string | null;
  date: string | null;
  result: string | null;
  opening: { eco: string; name: string } | null;
  depth: number;
  accuracy: { w: number | null; b: number | null };
  counts: {
    w: { inaccuracy: number; mistake: number; blunder: number };
    b: { inaccuracy: number; mistake: number; blunder: number };
  };
  updatedAt: number;
}

export interface SavedAnalysis extends SavedAnalysisSummary {
  pgn: string;
  evals: PositionEval[];
  bookPlies: number;
}

export class ApiError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
  ) {
    super(code);
    this.name = "ApiError";
  }
}

async function call<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: init?.method ?? "GET",
      headers: init?.body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
      credentials: "same-origin",
      cache: "no-store",
    });
  } catch {
    throw new ApiError("network", 0);
  }
  const data = (await res.json().catch(() => ({}))) as { error?: string } & T;
  if (!res.ok) throw new ApiError(data.error ?? "unknown", res.status);
  return data;
}

export const api = {
  me: () => call<{ user: ApiUser | null }>("/api/auth/me").then((r) => r.user),
  register: (username: string, password: string) =>
    call<{ user: ApiUser; recoveryCode: string }>("/api/auth/register", {
      method: "POST",
      body: { username, password },
    }),
  login: (username: string, password: string) =>
    call<{ user: ApiUser }>("/api/auth/login", {
      method: "POST",
      body: { username, password },
    }).then((r) => r.user),
  recover: (username: string, code: string, password: string) =>
    call<{ user: ApiUser; recoveryCode: string }>("/api/auth/recover", {
      method: "POST",
      body: { username, code, password },
    }),
  logout: () => call<{ ok: true }>("/api/auth/logout", { method: "POST", body: {} }),
  listAnalyses: () =>
    call<{ analyses: SavedAnalysisSummary[] }>("/api/analyses").then((r) => r.analyses),
  getAnalysis: (id: number) =>
    call<{ analysis: SavedAnalysis }>(`/api/analyses/${id}`).then((r) => r.analysis),
  saveAnalysis: (body: {
    pgn: string;
    depth: number;
    evals: PositionEval[];
    bookPlies: number;
    opening: { eco: string; name: string } | null;
  }) => call<{ id: number }>("/api/analyses", { method: "POST", body }).then((r) => r.id),
  deleteAnalysis: (id: number) => call<{ ok: true }>(`/api/analyses/${id}`, { method: "DELETE" }),
};
