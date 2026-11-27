// Draws the shareable report card (1200×630 PNG) on a canvas. No libraries.
// Fixed light palette so the image looks the same whatever theme the viewer uses.
import { winWhite, type Score } from "@/lib/chess/eval";

export const CARD_WIDTH = 1200;
export const CARD_HEIGHT = 630;

export interface ReportCardData {
  title: string;
  subtitle: string;
  opening: string | null;
  players: { name: string; accuracy: string; counts: string }[];
  scores: (Score | null)[];
  /** Plies (position index) with an inaccuracy / mistake / blunder, for the curve markers. */
  marks: { index: number; cls: "inaccuracy" | "mistake" | "blunder" }[];
  footer: string;
}

const C = {
  bg: "#ffffff",
  ink: "#1a1917",
  muted: "#625f59",
  soft: "#f5f3ef",
  graphBg: "#2a2724",
  graphFill: "#f1eee7",
  mid: "#6b6560",
  inaccuracy: "#a88000",
  mistake: "#e0670f",
  blunder: "#d23b2f",
};
const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

function fit(ctx: CanvasRenderingContext2D, text: string, max: number): string {
  if (ctx.measureText(text).width <= max) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > max) t = t.slice(0, -1);
  return `${t}…`;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function drawReportCard(ctx: CanvasRenderingContext2D, d: ReportCardData): void {
  const W = CARD_WIDTH;
  const P = 56;
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, W, CARD_HEIGHT);
  ctx.textBaseline = "alphabetic";

  ctx.fillStyle = C.ink;
  ctx.font = `700 44px ${FONT}`;
  ctx.fillText(fit(ctx, d.title, W - 2 * P), P, P + 40);
  ctx.fillStyle = C.muted;
  ctx.font = `400 24px ${FONT}`;
  ctx.fillText(fit(ctx, d.subtitle, W - 2 * P), P, P + 80);
  if (d.opening) ctx.fillText(fit(ctx, d.opening, W - 2 * P), P, P + 114);

  // Player tiles.
  const tileY = 196;
  const tileW = (W - 2 * P - 24) / 2;
  d.players.forEach((p, i) => {
    const x = P + i * (tileW + 24);
    ctx.fillStyle = C.soft;
    roundRect(ctx, x, tileY, tileW, 150, 16);
    ctx.fill();
    ctx.fillStyle = C.muted;
    ctx.font = `400 22px ${FONT}`;
    ctx.fillText(fit(ctx, `${i === 0 ? "○" : "●"} ${p.name}`, tileW - 48), x + 24, tileY + 40);
    ctx.fillStyle = C.ink;
    ctx.font = `700 60px ${FONT}`;
    ctx.fillText(p.accuracy, x + 24, tileY + 104);
    const w = ctx.measureText(p.accuracy).width;
    ctx.fillStyle = C.muted;
    ctx.font = `400 22px ${FONT}`;
    ctx.fillText("% precisión", x + 32 + w, tileY + 104);
    ctx.fillText(fit(ctx, p.counts, tileW - 48), x + 24, tileY + 134);
  });

  // Evaluation curve (white's win probability).
  const gx = P;
  const gy = 372;
  const gw = W - 2 * P;
  const gh = 180;
  ctx.save();
  roundRect(ctx, gx, gy, gw, gh, 16);
  ctx.clip();
  ctx.fillStyle = C.graphBg;
  ctx.fillRect(gx, gy, gw, gh);
  const n = d.scores.length;
  const X = (i: number) => gx + (n > 1 ? (i / (n - 1)) * gw : 0);
  const Y = (v: number) => gy + 8 + (1 - v / 100) * (gh - 16);
  const pts = d.scores
    .map((s, i) => (s ? ([X(i), Y(winWhite(s))] as const) : null))
    .filter((p): p is readonly [number, number] => p !== null);
  ctx.strokeStyle = C.mid;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(gx, gy + gh / 2);
  ctx.lineTo(gx + gw, gy + gh / 2);
  ctx.stroke();
  if (pts.length > 1) {
    ctx.fillStyle = C.graphFill;
    ctx.beginPath();
    ctx.moveTo(pts[0]![0], gy + gh);
    for (const [x, y] of pts) ctx.lineTo(x, y);
    ctx.lineTo(pts[pts.length - 1]![0], gy + gh);
    ctx.closePath();
    ctx.fill();
  }
  for (const m of d.marks) {
    const s = d.scores[m.index];
    if (!s) continue;
    ctx.fillStyle = C[m.cls];
    ctx.strokeStyle = C.graphBg;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(X(m.index), Y(winWhite(s)), m.cls === "blunder" ? 7 : 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();

  ctx.fillStyle = C.muted;
  ctx.font = `400 20px ${FONT}`;
  ctx.fillText(fit(ctx, d.footer, W - 2 * P), P, CARD_HEIGHT - 32);
}

/** Renders the card to a PNG blob. */
export async function reportCardBlob(d: ReportCardData): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = CARD_WIDTH;
  canvas.height = CARD_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas 2d unavailable");
  drawReportCard(ctx, d);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/png"),
  );
}
