// Opening identification and "book" moves, from lichess-org/chess-openings (CC0).

export interface Opening {
  eco: string;
  name: string;
  /** Ply (1-based) of the deepest named position reached. */
  ply: number;
}

/** Position table: EPD → [eco, name] for named positions, 0 for intermediate book positions. */
export type OpeningTable = Readonly<Record<string, readonly [string, string] | 0>>;

/** FEN without the half-move and full-move counters. */
export function toEpd(fen: string): string {
  return fen.split(" ").slice(0, 4).join(" ");
}

export interface OpeningInfo {
  opening: Opening | null;
  /** Number of leading moves that stay inside the opening table ("book"). */
  bookPlies: number;
}

/**
 * @param fens positions of the game; fens[0] is the start, fens[i] follows move i.
 * Only games from the standard start position can be in book.
 */
export function identifyOpening(fens: readonly string[], table: OpeningTable): OpeningInfo {
  const start = fens[0];
  if (!start || toEpd(start) !== "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -") {
    return { opening: null, bookPlies: 0 };
  }
  let opening: Opening | null = null;
  let bookPlies = 0;
  for (let i = 1; i < fens.length; i++) {
    const entry = table[toEpd(fens[i] as string)];
    if (entry === undefined) break;
    bookPlies = i;
    if (entry !== 0) opening = { eco: entry[0], name: entry[1], ply: i };
  }
  // Transpositions can bring a game back into a named position after leaving book.
  for (let i = fens.length - 1; i > bookPlies; i--) {
    const entry = table[toEpd(fens[i] as string)];
    if (entry && (!opening || i > opening.ply)) {
      opening = { eco: entry[0], name: entry[1], ply: i };
      break;
    }
  }
  return { opening, bookPlies };
}

let tablePromise: Promise<OpeningTable> | null = null;

/** Lazily fetches /openings.json once per page (browser only). */
export function loadOpeningTable(url = "/openings.json"): Promise<OpeningTable> {
  if (!tablePromise) {
    tablePromise = fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(`openings: HTTP ${r.status}`);
        return r.json() as Promise<{ positions: OpeningTable }>;
      })
      .then((j) => j.positions);
    tablePromise.catch(() => {
      tablePromise = null;
    });
  }
  return tablePromise;
}
