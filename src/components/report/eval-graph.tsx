"use client";

import { useEffect, useRef, useState } from "react";
import { winWhite } from "@/lib/chess/eval";
import { messages } from "@/messages/es";
import { useAnalysis } from "@/store/analysis";
import { useReport } from "@/store/use-report";

const MARKED = new Set(["inaccuracy", "mistake", "blunder"]);
const HEIGHT = 150;

export function EvalGraph() {
  const game = useAnalysis((s) => s.game);
  const evals = useAnalysis((s) => s.evals);
  const ply = useAnalysis((s) => s.ply);
  const goTo = useAnalysis((s) => s.goTo);
  const { classes } = useReport();
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(entry?.contentRect.width ?? 0));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const n = game?.fens.length ?? 0;
  const W = width;
  const H = HEIGHT;
  const X = (i: number) => (n > 1 ? (i / (n - 1)) * W : 0);
  const PAD = 6;
  const Y = (v: number) => PAD + (1 - v / 100) * (H - 2 * PAD);
  const pts = evals
    .map((e, i) => (e ? ([X(i), Y(winWhite(e.score))] as const) : null))
    .filter((p): p is readonly [number, number] => p !== null);

  return (
    <div
      ref={ref}
      className="relative cursor-pointer overflow-hidden rounded-xl bg-[var(--graph-bg)]"
      style={{ height: H }}
      role="img"
      aria-label={messages.analysis.graphLabel}
      data-testid="eval-graph"
      onClick={(ev) => {
        if (n < 2 || !W) return;
        const r = ev.currentTarget.getBoundingClientRect();
        goTo(Math.round(((ev.clientX - r.left) / r.width) * (n - 1)));
      }}
    >
      {W > 0 && n > 1 && (
        <svg width={W} height={H} className="absolute inset-0" aria-hidden>
          <line x1={0} x2={W} y1={H / 2} y2={H / 2} stroke="#6b6560" strokeDasharray="3 4" />
          {pts.length > 1 && (
            <path
              d={`M${pts[0]?.[0]},${H} ${pts.map(([x, y]) => `L${x.toFixed(1)},${y.toFixed(1)}`).join(" ")} L${pts[pts.length - 1]?.[0]},${H}Z`}
              fill="var(--graph-fill)"
            />
          )}
          {classes.map((c, i) => {
            const e = evals[i + 1];
            if (!c || !e || !MARKED.has(c.cls)) return null;
            return (
              <circle
                key={i}
                cx={X(i + 1)}
                cy={Y(winWhite(e.score))}
                r={c.cls === "blunder" ? 5 : 4}
                fill={`var(--c-${c.cls})`}
                stroke="#2a2724"
                strokeWidth={1.5}
              />
            );
          })}
          <line x1={X(ply)} x2={X(ply)} y1={0} y2={H} stroke="var(--accent)" strokeWidth={2} />
        </svg>
      )}
    </div>
  );
}

export function ClassLegend() {
  const items = ["book", "best", "good", "inaccuracy", "mistake", "blunder"] as const;
  return (
    <ul className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-muted">
      {items.map((k) => (
        <li key={k} className="flex items-center gap-1.5">
          <i className="h-2 w-2 rounded-full" style={{ background: `var(--c-${k})` }} aria-hidden />
          {messages.classes[k].label} {messages.classes[k].symbol}
        </li>
      ))}
    </ul>
  );
}
