// Accuracy per move and per player.
//
// Player accuracy follows Lichess (lila `AccuracyPercent.gameAccuracy`, verified against the
// source on 2026-11-27): the mean of a volatility-weighted mean and a harmonic mean of the
// per-move accuracies.
//  - windowSize = clamp(floor((positions - 1) / 10), 2, 8)
//  - windows: (windowSize - 2) copies of the first window, then every sliding window
//  - weight of move i = clamp(populationStdDev(window i), 0.5, 12)
//  - harmonic mean uses max(1, v) for every value (as scalalib `Maths.harmonicMean`)
// Deviations from Lichess (deliberate, per project spec):
//  - per-move accuracy uses the spec formula, without Lichess's "+1 uncertainty bonus";
//  - mates count as win 100 / 0 (Lichess maps them to ±1000 cp ≈ 97.5 / 2.5);
//  - forced (and, in phase 2, book) moves are excluded from both means.

/** Per-move accuracy from the win-probability loss (percentage points). */
export function moveAccuracy(loss: number): number {
  const raw = 103.1668 * Math.exp(-0.04354 * Math.max(0, loss)) - 3.1669;
  return Math.max(0, Math.min(100, raw));
}

function mean(xs: readonly number[]): number {
  return xs.reduce((s, x) => s + x, 0) / xs.length;
}

function populationStdDev(xs: readonly number[]): number {
  const m = mean(xs);
  return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / xs.length);
}

export interface AccuracyMove {
  color: "w" | "b";
  /** Win-probability points lost by the mover. */
  loss: number;
  /** Forced and book moves don't count. */
  counts: boolean;
}

export interface PlayerAccuracy {
  w: number | null;
  b: number | null;
}

/**
 * @param winsWhite win probability for white (0–100) of every position, starting with the
 *   initial one: length = moves.length + 1.
 * @param moves the moves between those positions.
 */
export function gameAccuracy(
  winsWhite: readonly number[],
  moves: readonly AccuracyMove[],
): PlayerAccuracy {
  if (winsWhite.length !== moves.length + 1) {
    throw new Error("gameAccuracy: winsWhite must have one more entry than moves");
  }
  if (moves.length === 0) return { w: null, b: null };

  const windowSize = Math.max(2, Math.min(8, Math.floor((winsWhite.length - 1) / 10)));
  const first = winsWhite.slice(0, windowSize);
  const windows: number[][] = [];
  for (let k = 0; k < Math.min(windowSize, winsWhite.length) - 2; k++) windows.push(first);
  for (let k = 0; k + windowSize <= winsWhite.length; k++) {
    windows.push(winsWhite.slice(k, k + windowSize));
  }
  const weights = windows.map((w) => Math.max(0.5, Math.min(12, populationStdDev(w))));

  const per = { w: [] as [number, number][], b: [] as [number, number][] };
  moves.forEach((m, i) => {
    const weight = weights[i];
    if (!m.counts || weight === undefined) return;
    per[m.color].push([moveAccuracy(m.loss), weight]);
  });

  const combine = (xs: [number, number][]): number | null => {
    if (xs.length === 0) return null;
    const wsum = xs.reduce((s, [, w]) => s + w, 0);
    const weighted = xs.reduce((s, [a, w]) => s + a * w, 0) / wsum;
    const harmonic = xs.length / xs.reduce((s, [a]) => s + 1 / Math.max(1, a), 0);
    return (weighted + harmonic) / 2;
  };
  return { w: combine(per.w), b: combine(per.b) };
}
