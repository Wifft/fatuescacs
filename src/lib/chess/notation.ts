// Display-only notation. Internally everything is English SAN + UCI.
export type Notation = "es" | "en";

const ES_PIECES: Record<string, string> = { K: "R", Q: "D", R: "T", B: "A", N: "C" };

/** English SAN → Spanish SAN (R, D, T, A, C). Castling and files are unchanged. */
export function toSpanishSan(san: string): string {
  return san.replace(/[KQRBN]/g, (c) => ES_PIECES[c] ?? c);
}

export function displaySan(san: string, notation: Notation): string {
  return notation === "es" ? toSpanishSan(san) : san;
}

const EN_PIECES: Record<string, string> = { R: "K", D: "Q", T: "R", A: "B", C: "N" };

/** Spanish SAN → English SAN ("Cxd7" → "Nxd7", "exd8=D+" → "exd8=Q+"). */
export function fromSpanishSan(san: string): string {
  return san.replace(/[RDTAC]/g, (c) => EN_PIECES[c] ?? c);
}

/** Normalises what a user typed into English SAN, according to their notation. */
export function parseUserSan(input: string, notation: Notation): string {
  const s = input
    .trim()
    .replace(/0-0-0|o-o-o/gi, "O-O-O")
    .replace(/0-0|o-o/gi, "O-O");
  return notation === "es" ? fromSpanishSan(s) : s;
}
