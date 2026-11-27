"use client";

import { formatScore, winWhite } from "@/lib/chess/eval";
import type { PositionEval } from "@/lib/engine/uci";
import { messages } from "@/messages/es";

export function EvalBar({
  evaluation,
  orientation,
}: {
  evaluation: PositionEval | null;
  orientation: "white" | "black";
}) {
  const w = evaluation ? winWhite(evaluation.score) : 50;
  const text = evaluation ? formatScore(evaluation.score) : "…";
  const whiteAhead = w >= 50;
  // White's share grows from the side white sits on.
  const fromBottom = orientation === "white";

  return (
    <div
      className="relative w-7 shrink-0 overflow-hidden rounded bg-[#2a2724]"
      role="meter"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(w)}
      aria-label={messages.analysis.evalBarLabel(text)}
      data-testid="eval-bar"
    >
      <div
        className="absolute inset-x-0 bg-[#f4f2ec] transition-[height] duration-300 ease-out"
        style={{ height: `${w}%`, [fromBottom ? "bottom" : "top"]: 0 }}
      />
      <span
        className="absolute inset-x-0 z-10 text-center text-[10px] leading-none font-bold"
        style={{
          [whiteAhead === fromBottom ? "bottom" : "top"]: 4,
          color: whiteAhead ? "#2a2724" : "#f4f2ec",
        }}
      >
        {compact(text)}
      </span>
    </div>
  );
}

/** Fits the score in the narrow bar: "+11.9" → "+12", "−0.4" → "-0.4". */
function compact(text: string): string {
  const t = text.replace("−", "-");
  const m = /^([+-])(\d+\.\d)$/.exec(t);
  if (m && Number(m[2]) >= 10) return `${m[1]}${Math.round(Number(m[2]))}`;
  return t;
}
