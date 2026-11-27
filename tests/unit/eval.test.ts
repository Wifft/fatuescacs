import { describe, expect, it } from "vitest";
import {
  formatScore,
  isMateFor,
  normalizeUciScore,
  terminalScore,
  winFor,
  winFromCp,
  winWhite,
} from "@/lib/chess/eval";

describe("winFromCp", () => {
  it("is 50 at 0 and symmetric", () => {
    expect(winFromCp(0)).toBe(50);
    expect(winFromCp(300) + winFromCp(-300)).toBeCloseTo(100, 10);
  });
  it("matches the Lichess formula", () => {
    const expected = 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * 100)) - 1);
    expect(winFromCp(100)).toBeCloseTo(expected, 12);
    expect(winFromCp(100)).toBeCloseTo(59.1, 1);
  });
  it("clamps centipawns to ±1000", () => {
    expect(winFromCp(5000)).toBe(winFromCp(1000));
    expect(winFromCp(-5000)).toBe(winFromCp(-1000));
    expect(winFromCp(1000)).toBeLessThan(100);
  });
});

describe("winWhite / winFor", () => {
  it("treats mates as certain", () => {
    expect(winWhite({ kind: "mate", mate: 3 })).toBe(100);
    expect(winWhite({ kind: "mate", mate: -2 })).toBe(0);
    expect(winFor({ kind: "mate", mate: -2 }, "b")).toBe(100);
  });
  it("handles results", () => {
    expect(winWhite({ kind: "result", result: "1-0" })).toBe(100);
    expect(winWhite({ kind: "result", result: "0-1" })).toBe(0);
    expect(winWhite({ kind: "result", result: "1/2-1/2" })).toBe(50);
  });
  it("flips for black", () => {
    expect(winFor({ kind: "cp", cp: 200 }, "b")).toBeCloseTo(100 - winFromCp(200), 10);
  });
});

describe("isMateFor", () => {
  it("detects forced and delivered mates for each side", () => {
    expect(isMateFor({ kind: "mate", mate: 2 }, "w")).toBe(true);
    expect(isMateFor({ kind: "mate", mate: 2 }, "b")).toBe(false);
    expect(isMateFor({ kind: "result", result: "0-1" }, "b")).toBe(true);
    expect(isMateFor({ kind: "result", result: "1/2-1/2" }, "w")).toBe(false);
    expect(isMateFor({ kind: "cp", cp: 9999 }, "w")).toBe(false);
  });
});

describe("formatScore", () => {
  it.each([
    [{ kind: "cp", cp: 130 }, "+1.3"],
    [{ kind: "cp", cp: -40 }, "−0.4"],
    [{ kind: "cp", cp: 0 }, "0.0"],
    [{ kind: "cp", cp: 4 }, "0.0"],
    [{ kind: "cp", cp: -4 }, "0.0"],
    [{ kind: "mate", mate: 3 }, "+M3"],
    [{ kind: "mate", mate: -2 }, "−M2"],
    [{ kind: "result", result: "1-0" }, "1-0"],
    [{ kind: "result", result: "0-1" }, "0-1"],
    [{ kind: "result", result: "1/2-1/2" }, "½-½"],
  ] as const)("%o → %s", (score, text) => {
    expect(formatScore(score)).toBe(text);
  });
});

describe("normalizeUciScore", () => {
  it("keeps white's scores and flips black's", () => {
    expect(normalizeUciScore({ type: "cp", value: 50 }, "w")).toEqual({ kind: "cp", cp: 50 });
    expect(normalizeUciScore({ type: "cp", value: 50 }, "b")).toEqual({ kind: "cp", cp: -50 });
    expect(normalizeUciScore({ type: "mate", value: 2 }, "b")).toEqual({ kind: "mate", mate: -2 });
    expect(normalizeUciScore({ type: "mate", value: -3 }, "b")).toEqual({ kind: "mate", mate: 3 });
  });
  it("maps mate 0 (side to move is mated) to a result", () => {
    expect(normalizeUciScore({ type: "mate", value: 0 }, "w")).toEqual({
      kind: "result",
      result: "0-1",
    });
    expect(normalizeUciScore({ type: "mate", value: 0 }, "b")).toEqual({
      kind: "result",
      result: "1-0",
    });
  });
});

describe("terminalScore", () => {
  it("resolves checkmate for the side that delivered it", () => {
    // Fool's mate: white is mated.
    expect(terminalScore("rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3")).toEqual({
      kind: "result",
      result: "0-1",
    });
  });
  it("resolves stalemate and insufficient material as draws", () => {
    expect(terminalScore("7k/5Q2/6K1/8/8/8/8/8 b - - 0 1")).toEqual({
      kind: "result",
      result: "1/2-1/2",
    });
    expect(terminalScore("8/8/4k3/8/8/3K4/8/8 w - - 0 1")).toEqual({
      kind: "result",
      result: "1/2-1/2",
    });
  });
  it("returns null when the game goes on", () => {
    expect(terminalScore("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1")).toBeNull();
  });
});
