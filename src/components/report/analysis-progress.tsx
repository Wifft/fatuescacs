"use client";

import { messages } from "@/messages/es";
import { useAnalysis } from "@/store/analysis";

const t = messages.progress;
const fmtS = (ms: number) =>
  `${(ms / 1000).toLocaleString("es-ES", { maximumFractionDigits: ms < 10_000 ? 2 : 1 })} s`;

export function AnalysisProgress() {
  const status = useAnalysis((s) => s.engineStatus);
  const engine = useAnalysis((s) => s.engine);
  const p = useAnalysis((s) => s.progress);

  let text: string;
  let pct = 0;
  if (status === "error") text = t.engineError;
  else if (status !== "ready" || !p) text = t.loadingEngine;
  else if (p.phase === "done") {
    text = t.done(p.depth, p.total);
    pct = 100;
  } else {
    // Quick pass fills the first 30 % of the bar, the full pass the rest.
    const frac = p.total ? p.done / p.total : 0;
    pct = p.phase === "quick" ? frac * 30 : 30 + frac * 70;
    text = p.phase === "quick" ? t.quick(p.done, p.total) : t.full(p.depth, p.done, p.total);
  }

  return (
    <div>
      <div
        className="h-1.5 overflow-hidden rounded-full bg-soft"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pct)}
        aria-label={text}
      >
        <i
          className="block h-full bg-accent transition-[width] duration-200"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p
        className="mt-1.5 text-sm text-muted"
        data-testid="progress-text"
        data-phase={p?.phase ?? "none"}
      >
        {text}
      </p>
      {engine?.build === "asm" && (
        <p className="text-sm text-[var(--c-mistake-text)]">{t.slowMode}</p>
      )}
    </div>
  );
}

export function Diagnostics() {
  const engine = useAnalysis((s) => s.engine);
  const m = useAnalysis((s) => s.metrics);
  const d = messages.diagnostics;
  const cells: [string, string][] = [
    [
      d.engine,
      engine
        ? `${engine.name || "Stockfish"} · ${engine.build === "wasm" ? "WASM" : "asm.js"}`
        : "–",
    ],
    [d.load, engine ? fmtS(engine.loadMs) : "–"],
    [d.speed, m?.avgNps ? `${Math.round(m.avgNps / 1000).toLocaleString("es-ES")} kN/s` : "–"],
    [d.perPosition, m ? fmtS(m.msPerPosition) : "–"],
    [d.total, m ? fmtS(m.totalMs) : "–"],
  ];
  return (
    <details className="border-t border-line pt-3.5">
      <summary className="min-h-8 cursor-pointer font-semibold">{d.title}</summary>
      <dl className="mt-2 grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] overflow-hidden rounded-xl border border-line">
        {cells.map(([k, v]) => (
          <div key={k} className="px-3.5 py-3 shadow-[0_0_0_0.5px_var(--line)]">
            <dt className="text-[13px] text-muted">{k}</dt>
            <dd className="text-lg font-semibold whitespace-nowrap" data-testid={`diag-${k}`}>
              {v}
            </dd>
          </div>
        ))}
      </dl>
    </details>
  );
}
