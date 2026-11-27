import { describe, expect, it } from "vitest";
import { gameAccuracy, moveAccuracy } from "@/lib/chess/accuracy";

describe("moveAccuracy", () => {
  it("is ~100 with no loss and decreases with loss", () => {
    expect(moveAccuracy(0)).toBeCloseTo(100, 3);
    expect(moveAccuracy(10)).toBeCloseTo(103.1668 * Math.exp(-0.4354) - 3.1669, 10);
    expect(moveAccuracy(10)).toBeLessThan(moveAccuracy(5));
  });
  it("is clamped to [0, 100]", () => {
    expect(moveAccuracy(100)).toBe(0);
    expect(moveAccuracy(-5)).toBeCloseTo(100, 3);
  });
});

describe("gameAccuracy", () => {
  it("returns null for both players without moves", () => {
    expect(gameAccuracy([50], [])).toEqual({ w: null, b: null });
  });

  it("rejects inconsistent input", () => {
    expect(() => gameAccuracy([50, 50], [])).toThrow();
  });

  it("gives ~100 to perfect play", () => {
    const wins = [50, 50, 50, 50, 50];
    const moves = [0, 1, 2, 3].map((i) => ({
      color: (i % 2 ? "b" : "w") as "w" | "b",
      loss: 0,
      counts: true,
    }));
    const a = gameAccuracy(wins, moves);
    expect(a.w).toBeCloseTo(100, 2);
    expect(a.b).toBeCloseTo(100, 2);
  });

  it("combines a volatility-weighted mean and a harmonic mean", () => {
    // 3 moves → windowSize 2, windows = sliding(2): weights = popStdDev of each pair.
    const wins = [50, 50, 30, 30];
    const moves = [
      { color: "w" as const, loss: 0, counts: true },
      { color: "b" as const, loss: 0, counts: true }, // white goes 50→30: black gains
      { color: "w" as const, loss: 0, counts: true },
    ];
    const a = gameAccuracy(wins, moves);
    expect(a.w).toBeCloseTo(100, 2);

    const lossy = [
      { color: "w" as const, loss: 20, counts: true },
      { color: "b" as const, loss: 0, counts: true },
      { color: "w" as const, loss: 0, counts: true },
    ];
    const r = gameAccuracy([50, 30, 30, 30], lossy);
    // Weights: std([50,30]) = 10, std([30,30]) → 0 → clamped to 0.5.
    const a1 = moveAccuracy(20);
    const a2 = moveAccuracy(0);
    const weighted = (a1 * 10 + a2 * 0.5) / 10.5;
    const harmonic = 2 / (1 / a1 + 1 / a2);
    expect(r.w).toBeCloseTo((weighted + harmonic) / 2, 8);
  });

  it("guards the harmonic mean against zero accuracies", () => {
    const r = gameAccuracy(
      [50, 0, 0],
      [
        { color: "w", loss: 100, counts: true },
        { color: "b", loss: 0, counts: true },
      ],
    );
    expect(Number.isFinite(r.w)).toBe(true);
  });

  it("ignores forced moves", () => {
    const r = gameAccuracy(
      [50, 10, 10],
      [
        { color: "w", loss: 40, counts: false },
        { color: "b", loss: 0, counts: true },
      ],
    );
    expect(r.w).toBeNull();
    expect(r.b).toBeCloseTo(100, 2);
  });
});
