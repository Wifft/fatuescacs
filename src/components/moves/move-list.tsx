"use client";

import { useEffect, useRef } from "react";
import { displaySan } from "@/lib/chess/notation";
import { messages } from "@/messages/es";
import { useAnalysis } from "@/store/analysis";
import { useReport } from "@/store/use-report";
import { classColor } from "../ui";

export function MoveList() {
  const game = useAnalysis((s) => s.game);
  const ply = useAnalysis((s) => s.ply);
  const notation = useAnalysis((s) => s.notation);
  const goTo = useAnalysis((s) => s.goTo);
  const { classes } = useReport();
  const listRef = useRef<HTMLOListElement>(null);

  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>('[aria-current="true"]');
    el?.scrollIntoView({ block: "nearest" });
  }, [ply]);

  if (!game) return null;

  // Rows of [number, white move index | null, black move index | null].
  const rows: [number, number | null, number | null][] = [];
  game.moves.forEach((m, i) => {
    if (m.color === "w" || rows.length === 0) rows.push([m.moveNumber, null, null]);
    const row = rows[rows.length - 1] as [number, number | null, number | null];
    if (m.color === "w") row[1] = i;
    else row[2] = i;
  });

  const cell = (i: number | null) => {
    if (i === null) return <span />;
    const m = game.moves[i];
    if (!m) return <span />;
    const c = classes[i];
    const info = c ? messages.classes[c.cls] : null;
    const selected = ply === i + 1;
    return (
      <button
        type="button"
        onClick={() => goTo(i + 1)}
        aria-current={selected ? "true" : undefined}
        aria-label={`${m.moveNumber}${m.color === "w" ? "." : "…"} ${displaySan(m.san, notation)}${info ? `, ${info.label}` : ""}`}
        data-testid={`move-${i + 1}`}
        data-class={c?.cls}
        className={`flex min-h-9 items-center gap-1.5 px-2.5 text-left text-[15px] ${
          selected ? "bg-foreground text-background" : "hover:bg-soft"
        }`}
      >
        <i
          className="h-2 w-2 shrink-0 rounded-full"
          style={{ background: c && c.cls !== "good" ? classColor(c.cls) : "transparent" }}
          aria-hidden
        />
        <span>{displaySan(m.san, notation)}</span>
        {info?.symbol && (
          <b
            className="text-[13px]"
            style={{ color: selected ? "inherit" : classColor(c?.cls) }}
            aria-hidden
          >
            {info.symbol}
          </b>
        )}
      </button>
    );
  };

  return (
    <ol
      ref={listRef}
      aria-label={messages.analysis.movesLabel}
      className="grid max-h-[260px] grid-cols-[3em_1fr_1fr] content-start overflow-auto rounded-xl border border-line md:max-h-[340px]"
      data-testid="move-list"
    >
      {rows.map(([n, w, b]) => (
        <li key={n} className="contents">
          <span className="bg-soft py-1.5 pl-2.5 text-sm text-muted">{n}.</span>
          {cell(w)}
          {cell(b)}
        </li>
      ))}
    </ol>
  );
}
