// Shareable links: the PGN travels compressed in the URL hash (never in the query string).
import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from "lz-string";

export function encodePgnHash(pgn: string): string {
  return compressToEncodedURIComponent(pgn.trim());
}

/** Returns the PGN in a `#…` hash, or null if the hash is empty or corrupt. */
export function decodePgnHash(hash: string): string | null {
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!raw) return null;
  const pgn = decompressFromEncodedURIComponent(raw);
  return pgn ? pgn : null;
}

export function analysisHref(pgn: string): string {
  return `/analysis#${encodePgnHash(pgn)}`;
}
