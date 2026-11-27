import { describe, expect, it } from "vitest";
import { isReadyOk, isUciOk, parseIdName, toLine } from "@/lib/engine/uci";

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
