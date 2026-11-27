"use client";

import { messages } from "@/messages/es";
import { useAnalysis } from "@/store/analysis";
import { useReport } from "@/store/use-report";

const t = messages.analysis;
const fmt = (x: number | null | undefined) =>
  x == null
    ? "–"
    : x.toLocaleString("es-ES", { maximumFractionDigits: 1, minimumFractionDigits: 1 });

export function AccuracySummary() {
  const headers = useAnalysis((s) => s.game?.headers);
  const { accuracy, counts } = useReport();
  const players = [
    { color: "w" as const, name: headers?.White || t.white },
    { color: "b" as const, name: headers?.Black || t.black },
  ];
  return (
    <div className="grid grid-cols-2 gap-2.5">
      {players.map(({ color, name }) => (
        <div
          key={color}
          className="rounded-xl bg-soft px-3.5 py-2.5"
          data-testid={`accuracy-${color}`}
        >
          <span className="block truncate text-[13px] text-muted">
            {color === "w" ? "○ " : "● "}
            {name}
          </span>
          <strong className="text-3xl leading-tight" data-testid={`accuracy-${color}-value`}>
            {fmt(accuracy?.[color])}
          </strong>{" "}
          <em className="text-[13px] text-muted not-italic">% {t.accuracy}</em>
          <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-2 text-[13px] text-muted">
            <dt style={{ color: "var(--c-inaccuracy-text)" }}>?!</dt>
            <dd>{t.inaccuracies(counts[color].inaccuracy)}</dd>
            <dt style={{ color: "var(--c-mistake-text)" }}>?</dt>
            <dd>{t.mistakes(counts[color].mistake)}</dd>
            <dt style={{ color: "var(--c-blunder-text)" }}>??</dt>
            <dd>{t.blunders(counts[color].blunder)}</dd>
          </dl>
        </div>
      ))}
    </div>
  );
}
