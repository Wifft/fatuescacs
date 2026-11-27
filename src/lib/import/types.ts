export type ImportSource = "lichess" | "chesscom";

export type Speed = "ultraBullet" | "bullet" | "blitz" | "rapid" | "classical" | "daily";

export interface ImportedPlayer {
  name: string;
  rating: number | null;
}

export interface ImportedGame {
  source: ImportSource;
  id: string;
  url: string;
  pgn: string;
  white: ImportedPlayer;
  black: ImportedPlayer;
  /** Colour of the imported user, if found among the players. */
  userColor: "w" | "b" | null;
  result: "1-0" | "0-1" | "1/2-1/2" | "*";
  speed: Speed | null;
  /** "3+2", "1 día"… */
  timeControl: string | null;
  /** Unix time in ms when the game ended (or started, if unknown). */
  playedAt: number;
  /** Opening reported by the site, if any (we also identify it ourselves). */
  siteOpening: { eco: string | null; name: string } | null;
}

export function userOutcome(g: ImportedGame): "win" | "loss" | "draw" | null {
  if (!g.userColor || g.result === "*") return null;
  if (g.result === "1/2-1/2") return "draw";
  return (g.result === "1-0") === (g.userColor === "w") ? "win" : "loss";
}

/** "180+2" seconds → "3+2"; "1/86400" → "1 día". */
export function formatTimeControl(initialSec: number, incrementSec: number): string {
  const min = initialSec / 60;
  const m = Number.isInteger(min)
    ? String(min)
    : min.toLocaleString("es-ES", { maximumFractionDigits: 2 });
  return `${m}+${incrementSec}`;
}
