// Chess.com published-data API: /pub/player/{user}/games/archives, then monthly archives.
// CORS verified from the browser on 2026-11-27.
import { ImportError, PoliteHttp, validUsername } from "./http";
import { formatTimeControl, type ImportedGame, type Speed } from "./types";

export const CHESSCOM = "https://api.chess.com";
/** Monthly archives to read at most (the last month, then earlier ones if needed). */
const MAX_ARCHIVES = 3;

interface ChesscomPlayer {
  username: string;
  rating?: number;
  result: string;
}

export interface ChesscomGame {
  url: string;
  uuid?: string;
  pgn?: string;
  time_control?: string;
  time_class?: string;
  end_time?: number;
  rules: string;
  white: ChesscomPlayer;
  black: ChesscomPlayer;
  eco?: string;
}

const DRAWS = new Set([
  "agreed",
  "repetition",
  "stalemate",
  "insufficient",
  "50move",
  "timevsinsufficient",
]);

const SPEEDS: Record<string, Speed> = {
  bullet: "bullet",
  blitz: "blitz",
  rapid: "rapid",
  daily: "daily",
};

function timeControl(tc: string | undefined): string | null {
  if (!tc) return null;
  const daily = /^1\/(\d+)$/.exec(tc);
  if (daily?.[1]) return `${Math.round(Number(daily[1]) / 86400)} d`;
  const m = /^(\d+)(?:\+(\d+))?$/.exec(tc);
  return m?.[1] ? formatTimeControl(Number(m[1]), Number(m[2] ?? 0)) : tc;
}

/** "https://www.chess.com/openings/Sicilian-Defense-Najdorf" → "Sicilian Defense Najdorf". */
function openingFromUrl(url: string | undefined): string | null {
  const slug = url?.split("/openings/")[1];
  return slug
    ? decodeURIComponent(slug)
        .replace(/-/g, " ")
        .replace(/[\s.]+\d.*$/, "")
        .trim()
    : null;
}

export function fromChesscom(g: ChesscomGame, username: string): ImportedGame | null {
  if (g.rules !== "chess" || !g.pgn) return null;
  const u = username.toLowerCase();
  const userColor =
    g.white.username.toLowerCase() === u ? "w" : g.black.username.toLowerCase() === u ? "b" : null;
  const result =
    g.white.result === "win"
      ? "1-0"
      : g.black.result === "win"
        ? "0-1"
        : DRAWS.has(g.white.result)
          ? "1/2-1/2"
          : "*";
  const ecoTag = /\[ECO "([^"]+)"\]/.exec(g.pgn)?.[1] ?? null;
  const openingName = openingFromUrl(g.eco ?? /\[ECOUrl "([^"]+)"\]/.exec(g.pgn)?.[1]);
  return {
    source: "chesscom",
    id: g.uuid ?? g.url,
    url: g.url,
    pgn: g.pgn,
    white: { name: g.white.username, rating: g.white.rating ?? null },
    black: { name: g.black.username, rating: g.black.rating ?? null },
    userColor,
    result,
    speed: (g.time_class && SPEEDS[g.time_class]) || null,
    timeControl: timeControl(g.time_control),
    playedAt: (g.end_time ?? 0) * 1000,
    siteOpening: openingName ? { eco: ecoTag, name: openingName } : null,
  };
}

export async function importChesscom(
  username: string,
  http: PoliteHttp,
  max = 20,
): Promise<ImportedGame[]> {
  if (!validUsername(username)) throw new ImportError("invalid-user", "Invalid username");
  const user = encodeURIComponent(username.toLowerCase());
  const res = await http.get(`${CHESSCOM}/pub/player/${user}/games/archives`);
  if (res.status === 404) throw new ImportError("not-found", "User not found", 404);
  if (res.status !== 200) throw new ImportError("bad-response", `HTTP ${res.status}`, res.status);

  let archives: string[];
  try {
    archives = (JSON.parse(res.text) as { archives: string[] }).archives ?? [];
  } catch {
    throw new ImportError("bad-response", "Invalid JSON");
  }
  const games: ImportedGame[] = [];
  for (const url of archives.slice(-MAX_ARCHIVES).reverse()) {
    if (!url.startsWith(`${CHESSCOM}/pub/player/`)) continue;
    const month = await http.get(url);
    if (month.status !== 200) continue;
    let raw: ChesscomGame[];
    try {
      raw = (JSON.parse(month.text) as { games: ChesscomGame[] }).games ?? [];
    } catch {
      continue;
    }
    for (const g of raw) {
      const ig = fromChesscom(g, username);
      if (ig) games.push(ig);
    }
    if (games.length >= max) break;
  }
  if (games.length === 0) throw new ImportError("no-games", "No standard games");
  return games.sort((a, b) => b.playedAt - a.playedAt).slice(0, max);
}
