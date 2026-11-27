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
