"use client";

import { useId, useMemo, useRef } from "react";
import { Chessboard } from "react-chessboard";
import { displaySan } from "@/lib/chess/notation";
import { describePosition } from "@/lib/chess/describe";
import { messages, positionText } from "@/messages/es";
import { useAnalysis } from "@/store/analysis";
import { Button } from "../ui";
import { EvalBar } from "./eval-bar";

const t = messages.analysis;
const SWIPE_PX = 40;

export function BoardPanel() {
  const game = useAnalysis((s) => s.game);
  const ply = useAnalysis((s) => s.ply);
  const evals = useAnalysis((s) => s.evals);
  const orientation = useAnalysis((s) => s.orientation);
  const notation = useAnalysis((s) => s.notation);
  const { step, goTo, flip } = useAnalysis.getState();
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const descId = useId();

  const fen = game?.fens[ply] ?? game?.startFen;
  const last = ply > 0 ? game?.moves[ply - 1] : undefined;
  const evaluation = evals[ply] ?? null;
  const total = game?.fens.length ?? 1;

  const options = useMemo(() => {
    const squareStyles: Record<string, React.CSSProperties> = {};
    if (last) {
      const hl = { backgroundColor: "rgba(255, 214, 64, 0.45)" };
      squareStyles[last.from] = hl;
      squareStyles[last.to] = hl;
    }
    const best = evaluation?.best;
    const arrows = best
      ? [
          {
            startSquare: best.slice(0, 2),
            endSquare: best.slice(2, 4),
            color: "rgba(47, 125, 225, 0.85)",
          },
        ]
      : [];
    return {
      id: "analysis-board",
      position: fen,
      boardOrientation: orientation,
      allowDragging: false,
      allowDrawingArrows: false,
      showNotation: true,
      arrows,
      squareStyles,
      lightSquareStyle: { backgroundColor: "var(--sq-light)" },
      darkSquareStyle: { backgroundColor: "var(--sq-dark)" },
      animationDurationInMs: 150,
    };
  }, [fen, orientation, last, evaluation?.best]);

  const description = fen ? positionText(describePosition(fen)) : "";
  const boardLabel = last
    ? `${last.moveNumber}${last.color === "w" ? "." : "…"} ${displaySan(last.san, notation)}`
    : t.start;

  return (
    <div>
      <div className="flex gap-2.5">
        <EvalBar evaluation={evaluation} orientation={orientation} />
        <div
          className="min-w-0 flex-1 touch-pan-y overflow-hidden rounded shadow-[0_8px_28px_rgba(60,40,20,0.18)]"
          role="img"
          aria-label={t.boardLabel(boardLabel)}
          aria-describedby={descId}
          data-testid="board"
          data-fen={fen}
          onPointerDown={(e) => {
            swipe.current = { x: e.clientX, y: e.clientY };
          }}
          onPointerUp={(e) => {
            const s = swipe.current;
            swipe.current = null;
            if (!s) return;
            const dx = e.clientX - s.x;
            const dy = e.clientY - s.y;
            if (Math.abs(dx) > SWIPE_PX && Math.abs(dx) > Math.abs(dy) * 1.5) step(dx < 0 ? 1 : -1);
          }}
          onPointerCancel={() => {
            swipe.current = null;
          }}
        >
          {/* Display only: react-chessboard's pieces are unnamed buttons, so keep them out of
              the accessibility tree and the tab order; the description below replaces them. */}
          <div inert aria-hidden="true">
            <Chessboard options={options} />
          </div>
        </div>
      </div>
      <p id={descId} className="sr-only">
        {description}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button aria-label={t.first} onClick={() => goTo(0)} disabled={ply === 0}>
          «
        </Button>
        <Button aria-label={t.prev} onClick={() => step(-1)} disabled={ply === 0}>
          ‹
        </Button>
        <Button aria-label={t.next} onClick={() => step(1)} disabled={ply >= total - 1}>
          ›
        </Button>
        <Button aria-label={t.last} onClick={() => goTo(total - 1)} disabled={ply >= total - 1}>
          »
        </Button>
        <Button onClick={flip}>{t.flip}</Button>
      </div>
      <details className="mt-3 text-sm">
        <summary className="min-h-8 cursor-pointer text-muted">{t.describe}</summary>
        <p className="mt-1" data-testid="position-description">
          {description}
        </p>
      </details>
    </div>
  );
}
