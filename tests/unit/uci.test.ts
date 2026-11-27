import { describe, expect, it } from "vitest";
import {
  isReadyOk,
  isUciOk,
  parseBestMove,
  parseIdName,
  parseInfo,
  toLine,
  toPositionEval,
} from "@/lib/engine/uci";

describe("uci handshake helpers", () => {
  it("normalises worker messages to trimmed lines", () => {
    expect(toLine("readyok\n")).toBe("readyok");
    expect(toLine("  uciok  ")).toBe("uciok");
    expect(toLine(42)).toBe("42");
  });

  it("recognises uciok and readyok exactly", () => {
    expect(isUciOk("uciok")).toBe(true);
    expect(isUciOk("uciokx")).toBe(false);
    expect(isReadyOk("readyok")).toBe(true);
    expect(isReadyOk("info string readyok")).toBe(false);
  });

  it("parses the engine name from id name lines", () => {
    expect(parseIdName("id name Stockfish 19")).toBe("Stockfish 19");
    expect(parseIdName("id name   Stockfish 19 Lite  ")).toBe("Stockfish 19 Lite");
    expect(parseIdName("id author the Stockfish developers")).toBeNull();
    expect(parseIdName("id name ")).toBeNull();
    expect(parseIdName("info depth 1")).toBeNull();
  });
});

describe("parseInfo", () => {
  it("parses a full main-line info", () => {
    const i = parseInfo(
      "info depth 16 seldepth 22 multipv 1 score cp -34 nodes 812345 nps 512000 hashfull 120 tbhits 0 time 1586 pv e7e5 g1f3 b8c6",
    );
    expect(i).toEqual({
      depth: 16,
      multipv: 1,
      score: { type: "cp", value: -34 },
      nodes: 812345,
      nps: 512000,
      timeMs: 1586,
      pv: ["e7e5", "g1f3", "b8c6"],
    });
  });

  it("parses mate scores and bounds", () => {
    expect(parseInfo("info depth 20 score mate -3 pv a1a2")?.score).toEqual({
      type: "mate",
      value: -3,
    });
    expect(parseInfo("info depth 12 score cp 55 lowerbound nodes 10 pv e2e4")?.score).toEqual({
      type: "cp",
      value: 55,
      bound: "lower",
    });
  });

  it("ignores lines without score or pv", () => {
    expect(parseInfo("info string NNUE evaluation using nn-xyz.nnue")).toBeNull();
    expect(parseInfo("info depth 10 currmove e2e4 currmovenumber 1")).toBeNull();
    expect(parseInfo("info depth 0 score mate 0")).toBeNull();
    expect(parseInfo("bestmove e2e4")).toBeNull();
  });

  it("reads multipv", () => {
    expect(parseInfo("info depth 5 multipv 2 score cp 1 pv d2d4")?.multipv).toBe(2);
  });
});

describe("parseBestMove", () => {
  it("parses bestmove with and without ponder", () => {
    expect(parseBestMove("bestmove e2e4 ponder e7e5")).toEqual({ best: "e2e4", ponder: "e7e5" });
    expect(parseBestMove("bestmove e7e8q")).toEqual({ best: "e7e8q" });
    expect(parseBestMove("bestmove (none)")).toEqual({ best: null });
    expect(parseBestMove("info depth 1")).toBeNull();
  });
});

describe("toPositionEval", () => {
  it("normalises to white's point of view", () => {
    const info = parseInfo("info depth 14 score cp 120 nps 400000 pv e7e5 g1f3");
    const e = toPositionEval(info, { best: "e7e5" }, "b");
    expect(e.score).toEqual({ kind: "cp", cp: -120 });
    expect(e.best).toBe("e7e5");
    expect(e.pv).toEqual(["e7e5", "g1f3"]);
    expect(e.depth).toBe(14);
    expect(e.nps).toBe(400000);
  });

  it("falls back to the bestmove when the pv disagrees", () => {
    const info = parseInfo("info depth 3 score cp 10 pv d2d4 d7d5");
    expect(toPositionEval(info, { best: "e2e4" }, "w").pv).toEqual(["e2e4"]);
  });

  it("handles missing info", () => {
    expect(toPositionEval(null, { best: "e2e4" }, "w")).toEqual({
      score: { kind: "cp", cp: 0 },
      best: "e2e4",
      pv: [],
      depth: 0,
    });
  });
});
