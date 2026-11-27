import { describe, expect, it } from "vitest";
import { classifyMove } from "@/lib/chess/classify";
import { fenAfterUci, numberLine, uciLineToSan } from "@/lib/chess/line";
import { OPERA_GAME_PGN } from "@/lib/chess/samples";
import { analysisHref, decodePgnHash, encodePgnHash } from "@/lib/share";

const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const AFTER_E4 = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1";

describe("engine lines", () => {
  it("converts UCI to SAN and stops at illegal moves", () => {
    expect(uciLineToSan(START, ["e2e4", "e7e5", "g1f3"])).toEqual(["e4", "e5", "Nf3"]);
    expect(uciLineToSan(START, ["e2e4", "e2e4", "g1f3"])).toEqual(["e4"]);
    expect(uciLineToSan(START, ["e2e4", "e7e5", "g1f3", "b8c6", "f1b5", "a7a6"], 5)).toHaveLength(
      5,
    );
  });
  it("handles promotions", () => {
    expect(uciLineToSan("8/P7/8/8/8/8/k6K/8 w - - 0 1", ["a7a8q"])).toEqual(["a8=Q+"]);
  });
  it("numbers lines from either side", () => {
    expect(numberLine(START, ["e4", "e5", "Nf3"])).toBe("1. e4 e5 2. Nf3");
    expect(numberLine(AFTER_E4, ["e5", "Nf3", "Nc6"])).toBe("1… e5 2. Nf3 Nc6");
  });
  it("computes the FEN after a move", () => {
    expect(fenAfterUci(START, "e2e4")).toBe(AFTER_E4);
    expect(fenAfterUci(START, "e2e5")).toBeNull();
  });
});

describe("share links", () => {
  it("round-trips the PGN through the hash", () => {
    const href = analysisHref(OPERA_GAME_PGN);
    expect(href.startsWith("/analysis#")).toBe(true);
    expect(href).not.toContain("?");
    expect(decodePgnHash(href.slice(href.indexOf("#")))).toBe(OPERA_GAME_PGN.trim());
    expect(decodePgnHash(encodePgnHash("1. e4 *"))).toBe("1. e4 *");
  });
  it("rejects empty or corrupt hashes", () => {
    expect(decodePgnHash("")).toBeNull();
    expect(decodePgnHash("#")).toBeNull();
    expect(decodePgnHash("#%%%not-lz")).toBeNull();
  });
});

describe("classification reasons", () => {
  const base = { color: "w" as const, playedUci: "a2a3", bestUci: "d2d4", legalMoves: 20 };
  it("explains mate-related verdicts", () => {
    expect(
      classifyMove({ ...base, before: { kind: "cp", cp: 0 }, after: { kind: "mate", mate: -2 } })
        .reason,
    ).toBe("allows-mate");
    expect(
      classifyMove({ ...base, before: { kind: "mate", mate: 2 }, after: { kind: "cp", cp: 500 } })
        .reason,
    ).toBe("lost-mate");
    expect(
      classifyMove({ ...base, before: { kind: "cp", cp: 0 }, after: { kind: "cp", cp: -50 } })
        .reason,
    ).toBeUndefined();
  });
});
