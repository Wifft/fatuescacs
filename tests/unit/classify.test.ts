import { describe, expect, it } from "vitest";
import { classifyMove, gradeLoss, type ClassifyInput } from "@/lib/chess/classify";
import { winFromCp, type Score } from "@/lib/chess/eval";

const cp = (v: number): Score => ({ kind: "cp", cp: v });
const mate = (v: number): Score => ({ kind: "mate", mate: v });

function input(over: Partial<ClassifyInput>): ClassifyInput {
  return {
    color: "w",
    playedUci: "e2e4",
    bestUci: "d2d4",
    before: cp(0),
    after: cp(0),
    legalMoves: 20,
    ...over,
  };
}

/** Finds a cp value so that white's loss from `fromCp` is ≈ `loss` points. */
function cpForLoss(fromCp: number, loss: number): number {
  const target = winFromCp(fromCp) - loss;
  let lo = -1000;
  let hi = fromCp;
  for (let k = 0; k < 60; k++) {
    const mid = (lo + hi) / 2;
    if (winFromCp(mid) > target) hi = mid;
    else lo = mid;
  }
  return (lo + hi) / 2;
}

describe("gradeLoss thresholds", () => {
  it.each([
    [0, "good"],
    [4.99, "good"],
    [5, "inaccuracy"],
    [9.99, "inaccuracy"],
    [10, "mistake"],
    [19.99, "mistake"],
    [20, "blunder"],
    [80, "blunder"],
  ] as const)("loss %d → %s", (loss, cls) => expect(gradeLoss(loss)).toBe(cls));
});

describe("classifyMove", () => {
  it("marks the engine move as best", () => {
    expect(classifyMove(input({ playedUci: "d2d4" })).cls).toBe("best");
  });

  it("grades by win-probability loss from the mover's point of view", () => {
    expect(classifyMove(input({ after: cp(cpForLoss(0, 7)) })).cls).toBe("inaccuracy");
    expect(classifyMove(input({ after: cp(cpForLoss(0, 15)) })).cls).toBe("mistake");
    expect(classifyMove(input({ after: cp(cpForLoss(0, 30)) })).cls).toBe("blunder");
    // Black: white's eval going up is a loss for black.
    const r = classifyMove(input({ color: "b", before: cp(0), after: cp(-cpForLoss(0, 30)) }));
    expect(r.cls).toBe("blunder");
    expect(r.loss).toBeCloseTo(30, 3);
  });

  it("never reports negative loss", () => {
    const r = classifyMove(input({ before: cp(0), after: cp(200) }));
    expect(r.loss).toBe(0);
    expect(r.cls).toBe("good");
  });

  it("forced: only one legal move", () => {
    const r = classifyMove(input({ legalMoves: 1, after: cp(-900) }));
    expect(r.cls).toBe("forced");
  });

  it("delivering mate is best", () => {
    expect(
      classifyMove(input({ before: mate(1), after: { kind: "result", result: "1-0" } })).cls,
    ).toBe("best");
  });

  describe("correction 1: still clearly winning", () => {
    it("caps at good when winAfter ≥ 90", () => {
      // +1000 → +600: loses ~10 points but white still wins ~90%.
      const r = classifyMove(input({ before: cp(1000), after: cp(600) }));
      expect(r.winAfter).toBeGreaterThanOrEqual(90);
      expect(r.loss).toBeGreaterThan(5);
      expect(r.cls).toBe("good");
    });
    it("does not apply below 90", () => {
      const r = classifyMove(input({ before: cp(1000), after: cp(350) }));
      expect(r.winAfter).toBeLessThan(90);
      expect(r.cls).not.toBe("good");
    });
  });

  describe("correction 2: mates", () => {
    it("keeping a (longer) forced mate is at most good", () => {
      expect(classifyMove(input({ before: mate(2), after: mate(5) })).cls).toBe("good");
    });
    it("losing a forced mate is at least a mistake, even if still winning", () => {
      const r = classifyMove(input({ before: mate(3), after: cp(900) }));
      expect(r.winAfter).toBeGreaterThan(90);
      expect(r.cls).toBe("mistake");
    });
    it("losing a forced mate into a bad position is a blunder", () => {
      expect(classifyMove(input({ before: mate(3), after: cp(0) })).cls).toBe("blunder");
    });
    it("allowing a new forced mate is a blunder", () => {
      expect(classifyMove(input({ before: cp(50), after: mate(-4) })).cls).toBe("blunder");
      // Even from a lost position.
      expect(classifyMove(input({ before: cp(-900), after: mate(-6) })).cls).toBe("blunder");
    });
    it("when already getting mated, a faster mate is not a new mate", () => {
      const r = classifyMove(input({ before: mate(-8), after: mate(-3) }));
      expect(r.loss).toBe(0);
      expect(r.cls).toBe("good");
    });
    it("works for black", () => {
      expect(classifyMove(input({ color: "b", before: mate(-2), after: mate(-4) })).cls).toBe(
        "good",
      );
      expect(classifyMove(input({ color: "b", before: cp(0), after: mate(3) })).cls).toBe(
        "blunder",
      );
    });
  });

  describe("correction 3: lost position", () => {
    it("downgrades one level when winBefore ≤ 10", () => {
      const before = -600; // white ≈ 9.9%
      expect(winFromCp(before)).toBeLessThanOrEqual(10);
      const r = classifyMove(input({ before: cp(before), after: cp(-1000) }));
      expect(r.loss).toBeGreaterThanOrEqual(5);
      expect(r.loss).toBeLessThan(10);
      expect(r.cls).toBe("good"); // inaccuracy → good
    });
  });
});
