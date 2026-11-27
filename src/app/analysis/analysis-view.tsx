"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { BoardPanel } from "@/components/board/board-panel";
import { MoveList } from "@/components/moves/move-list";
import { AccuracySummary } from "@/components/report/accuracy-summary";
import { AnalysisProgress, Diagnostics } from "@/components/report/analysis-progress";
import { CurrentMove } from "@/components/report/current-move";
import { ExportButtons } from "@/components/report/export-buttons";
import { SaveButton } from "@/components/report/save-button";
import { ClassLegend, EvalGraph } from "@/components/report/eval-graph";
import { Select } from "@/components/ui";
import type { Notation } from "@/lib/chess/notation";
import { identifyOpening, loadOpeningTable } from "@/lib/chess/openings";
import { parsePgn, PgnError } from "@/lib/chess/pgn";
import { decodePgnHash } from "@/lib/share";
import { messages, pgnErrorMessage } from "@/messages/es";
import { DEPTH_OPTIONS, hydratePreferences, useAnalysis } from "@/store/analysis";
import { cancelAnalysis, runAnalysis } from "@/store/run-analysis";

const t = messages.analysis;

type LoadState = { status: "loading" } | { status: "ok" } | { status: "error"; message: string };

function loadFromHash(): LoadState {
  const pgn = decodePgnHash(window.location.hash);
  if (!pgn) return { status: "error", message: window.location.hash ? t.badLink : t.noGame };
  let game;
  try {
    game = parsePgn(pgn);
  } catch (err) {
    return { status: "error", message: err instanceof PgnError ? pgnErrorMessage(err) : t.badLink };
  }
  useAnalysis.getState().setGame(game, pgn);
  void runAnalysis();
  loadOpeningTable()
    .then((table) => useAnalysis.getState().setOpening(game, identifyOpening(game.fens, table)))
    .catch(() => {
      /* no opening data: the analysis works without it */
    });
  return { status: "ok" };
}

export function AnalysisView() {
  const [load, setLoad] = useState<LoadState>({ status: "loading" });
  const headers = useAnalysis((s) => s.game?.headers);
  const opening = useAnalysis((s) => s.opening?.opening);
  const notation = useAnalysis((s) => s.notation);
  const depth = useAnalysis((s) => s.depth);
  const ids = { notation: useId(), depth: useId() };

  useEffect(() => {
    hydratePreferences();
    const onHash = () => setLoad(loadFromHash());
    onHash();
    window.addEventListener("hashchange", onHash);
    return () => {
      window.removeEventListener("hashchange", onHash);
      cancelAnalysis();
    };
  }, []);

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      const el = ev.target as HTMLElement | null;
      if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return;
      if (ev.altKey || ev.ctrlKey || ev.metaKey) return;
      const s = useAnalysis.getState();
      const last = (s.game?.fens.length ?? 1) - 1;
      const actions: Record<string, () => void> = {
        ArrowLeft: () => s.step(-1),
        ArrowRight: () => s.step(1),
        Home: () => s.goTo(0),
        End: () => s.goTo(last),
      };
      const action = actions[ev.key];
      if (action) {
        ev.preventDefault();
        action();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  if (load.status === "error") {
    return (
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12 sm:px-8">
        <p role="alert" data-testid="analysis-error">
          {load.message}
        </p>
        <Link href="/" className="mt-4 inline-block underline">
          {t.goHome}
        </Link>
      </main>
    );
  }

  const title = [headers?.White ?? t.white, headers?.Black ?? t.black].join(" – ");
  const sub = [headers?.Event, headers?.Date?.replace(/\.\?\?/g, ""), headers?.Result]
    .filter(Boolean)
    .join(" · ");

  return (
    <main className="mx-auto w-full max-w-[1240px] flex-1 px-4 py-6 sm:px-[4vw]">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl leading-tight font-bold text-balance sm:text-3xl">{title}</h1>
          {sub && <p className="text-[15px] text-muted">{sub}</p>}
          {opening && (
            <p className="text-[15px] text-muted" data-testid="opening">
              {opening.eco} · {opening.name}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/"
            className="inline-flex min-h-11 items-center rounded-lg border border-line bg-soft px-3"
          >
            {t.back}
          </Link>
          <ExportButtons />
        </div>
      </header>

      <div className="grid items-start gap-[clamp(18px,3vw,36px)] md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <div>
          <BoardPanel />
          <div className="mt-3 flex flex-wrap items-center gap-2.5 text-[15px]">
            <label htmlFor={ids.notation}>{t.notation}</label>
            <Select
              id={ids.notation}
              value={notation}
              onChange={(e) => useAnalysis.getState().setNotation(e.target.value as Notation)}
            >
              <option value="es">{t.notationEs}</option>
              <option value="en">{t.notationEn}</option>
            </Select>
            <label htmlFor={ids.depth}>{t.depth}</label>
            <Select
              id={ids.depth}
              value={depth}
              data-testid="depth-select"
              onChange={(e) => {
                useAnalysis.getState().setDepth(Number(e.target.value));
                void runAnalysis();
              }}
            >
              {DEPTH_OPTIONS.map((d) => (
                <option key={d} value={d}>
                  {messages.depth[d]}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div className="grid gap-4">
          <AccuracySummary />
          <SaveButton />
          <CurrentMove />
          <AnalysisProgress />
          <MoveList />
        </div>
      </div>

      <section className="mt-8">
        <h2 className="mb-2.5 text-xl font-semibold">{t.graphTitle}</h2>
        <EvalGraph />
        <ClassLegend />
      </section>

      <section className="mt-8">
        <Diagnostics />
      </section>
    </main>
  );
}
