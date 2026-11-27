// Lichess: GET /api/games/user/{user}?max=N&pgnInJson=true&opening=true (NDJSON, CORS *).
// Verified on 2026-11-27 against the official OpenAPI spec and a real request.
import { ImportError, parseNdjson, PoliteHttp, validUsername } from "./http";
import { formatTimeControl, type ImportedGame, type Speed } from "./types";

export const LICHESS = "https://lichess.org";

interface LichessPlayer {
  user?: { name: string; id: string };
  aiLevel?: number;
  rating?: number;
}

export interface LichessGame {
  id: string;
  variant: string;
  speed: string;
  status: string;
  createdAt: number;
  lastMoveAt?: number;
  players: { white: LichessPlayer; black: LichessPlayer };
  winner?: "white" | "black";
  opening?: { eco: string; name: string };
  clock?: { initial: number; increment: number };
  daysPerTurn?: number;
  pgn?: string;
}

const SPEEDS: Record<string, Speed> = {
  ultraBullet: "ultraBullet",
  bullet: "bullet",
  blitz: "blitz",
  rapid: "rapid",
  classical: "classical",
  correspondence: "daily",
};

const playerName = (p: LichessPlayer) =>
  p.user?.name ?? (p.aiLevel ? `Stockfish nivel ${p.aiLevel}` : "Anónimo");

export function fromLichess(g: LichessGame, username: string): ImportedGame | null {
  if (g.variant !== "standard" || !g.pgn) return null;
  const u = username.toLowerCase();
  const userColor =
    g.players.white.user?.id === u ? "w" : g.players.black.user?.id === u ? "b" : null;
  const result =
    g.winner === "white"
      ? "1-0"
      : g.winner === "black"
        ? "0-1"
        : g.status === "started" || g.status === "created"
          ? "*"
          : "1/2-1/2";
  return {
    source: "lichess",
    id: g.id,
    url: `${LICHESS}/${g.id}`,
    pgn: g.pgn,
    white: { name: playerName(g.players.white), rating: g.players.white.rating ?? null },
    black: { name: playerName(g.players.black), rating: g.players.black.rating ?? null },
    userColor,
    result,
    speed: SPEEDS[g.speed] ?? null,
    timeControl: g.clock
      ? formatTimeControl(g.clock.initial, g.clock.increment)
      : g.daysPerTurn
        ? `${g.daysPerTurn} d`
        : null,
    playedAt: g.lastMoveAt ?? g.createdAt,
    siteOpening: g.opening ? { eco: g.opening.eco, name: g.opening.name } : null,
  };
}

export async function importLichess(
  username: string,
  http: PoliteHttp,
  max = 20,
): Promise<ImportedGame[]> {
  if (!validUsername(username)) throw new ImportError("invalid-user", "Invalid username");
  const user = encodeURIComponent(username);
  const res = await http.get(
    `${LICHESS}/api/games/user/${user}?max=${max}&pgnInJson=true&opening=true`,
    { Accept: "application/x-ndjson" },
  );
  if (res.status === 404) {
    // Lichess answers 404 both for unknown users and for users without games.
    const profile = await http.get(`${LICHESS}/api/user/${user}`);
    if (profile.status === 404) throw new ImportError("not-found", "User not found", 404);
    throw new ImportError("no-games", "No games");
  }
  if (res.status !== 200) throw new ImportError("bad-response", `HTTP ${res.status}`, res.status);
  let raw: LichessGame[];
  try {
    raw = parseNdjson<LichessGame>(res.text);
  } catch {
    throw new ImportError("bad-response", "Invalid NDJSON");
  }
  const games = raw.map((g) => fromLichess(g, username)).filter((g): g is ImportedGame => !!g);
  if (games.length === 0) throw new ImportError("no-games", "No standard games");
  return games;
}
