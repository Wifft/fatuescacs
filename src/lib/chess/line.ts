// Engine lines (UCI) → SAN, for display.
import { Chess } from "chess.js";

/** Converts up to `max` UCI moves from `fen` into SAN. Stops at the first illegal move. */
export function uciLineToSan(fen: string, uci: readonly string[], max = 5): string[] {
  const g = new Chess(fen);
  const out: string[] = [];
  for (const u of uci.slice(0, max)) {
    try {
      const m = g.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] });
      out.push(m.san);
    } catch {
      break;
    }
  }
  return out;
}

/** FEN after playing one UCI move, or null if it is illegal. */
export function fenAfterUci(fen: string, uci: string): string | null {
  try {
    const g = new Chess(fen);
    g.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
    return g.fen();
  } catch {
    return null;
  }
}

/** Full-move number and colour of the side to move in `fen`. */
export function fenMoveInfo(fen: string): { moveNumber: number; color: "w" | "b" } {
  const parts = fen.split(" ");
  return { moveNumber: Number(parts[5]) || 1, color: parts[1] === "b" ? "b" : "w" };
}

/** "16. Db8+ Cxb8 17. Td8#" style numbering for a SAN line starting at `fen`. */
export function numberLine(fen: string, sans: readonly string[]): string {
  let { moveNumber, color } = fenMoveInfo(fen);
  const parts: string[] = [];
  sans.forEach((san, i) => {
    if (color === "w") parts.push(`${moveNumber}. ${san}`);
    else parts.push(i === 0 ? `${moveNumber}… ${san}` : san);
    if (color === "b") moveNumber++;
    color = color === "w" ? "b" : "w";
  });
  return parts.join(" ");
}
