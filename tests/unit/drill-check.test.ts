import { describe, expect, it } from "vitest";
import { gradeAnswer } from "@/lib/chess/drill-check";

describe("gradeAnswer", () => {
  it("the engine move is always right", () => {
    expect(gradeAnswer("w", "e2e4", "e2e4")).toEqual({ verdict: "best", loss: 0 });
  });
  it("another move counts if it loses less than 5 points", () => {
    const r = gradeAnswer("w", "d2d4", "e2e4", { kind: "cp", cp: 30 }, { kind: "cp", cp: 20 });
    expect(r.verdict).toBe("good-enough");
    expect(r.loss).toBeLessThan(5);
  });
  it("a worse move is wrong, from the mover's point of view", () => {
    expect(
      gradeAnswer("w", "a2a4", "e2e4", { kind: "cp", cp: 30 }, { kind: "cp", cp: -300 }).verdict,
    ).toBe("wrong");
    // Black: white's eval going up is bad for black.
    expect(
      gradeAnswer("b", "a7a5", "e7e5", { kind: "cp", cp: 0 }, { kind: "cp", cp: 400 }).verdict,
    ).toBe("wrong");
    expect(
      gradeAnswer("b", "c7c5", "e7e5", { kind: "cp", cp: 0 }, { kind: "cp", cp: 10 }).verdict,
    ).toBe("good-enough");
  });
  it("finding another mate also counts", () => {
    const r = gradeAnswer(
      "w",
      "d1h5",
      "f3f7",
      { kind: "mate", mate: 1 },
      { kind: "result", result: "1-0" },
    );
    expect(r.verdict).toBe("good-enough");
  });
  it("without engine data a different move is wrong", () => {
    expect(gradeAnswer("w", "d2d4", "e2e4").verdict).toBe("wrong");
  });
});
