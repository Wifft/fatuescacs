// Pure helpers for parsing UCI output lines. No DOM / Worker dependencies.
// Phase 1 extends this with `info` and `bestmove` parsing.

/** Normalises a raw worker message into a trimmed line. */
export function toLine(data: unknown): string {
  return String(data).trim();
}

export function isUciOk(line: string): boolean {
  return line === "uciok";
}

export function isReadyOk(line: string): boolean {
  return line === "readyok";
}

/** Returns the engine name from an `id name <name>` line, or null for any other line. */
export function parseIdName(line: string): string | null {
  const m = /^id name (.+)$/.exec(line);
  return m?.[1]?.trim() || null;
}
