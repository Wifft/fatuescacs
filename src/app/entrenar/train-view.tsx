"use client";

import { Chess } from "chess.js";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Chessboard } from "react-chessboard";
import { Button } from "@/components/ui";
import { api, type ApiDrill } from "@/lib/api-client";
import { DRILL_CHECK_DEPTH, gradeAnswer, type DrillVerdict } from "@/lib/chess/drill-check";
import { terminalScore } from "@/lib/chess/eval";
import { fenAfterUci, numberLine, uciLineToSan } from "@/lib/chess/line";
import { displaySan } from "@/lib/chess/notation";
import { getBrowserEngine } from "@/lib/engine/browser";
import { messages } from "@/messages/es";
import { hydratePreferences, useAnalysis } from "@/store/analysis";
import { useSession } from "@/store/session";

const t = messages.train;
const dateFmt = new Intl.DateTimeFormat("es-ES", { dateStyle: "long" });

type Load =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; drills: ApiDrill[]; total: number; nextDueAt: number | null };

type Answer =
  | { status: "waiting" }
  | { status: "checking"; uci: string }
  | { status: "done"; uci: string | null; verdict: DrillVerdict; loss: number };

export function TrainView() {
  const { user, status: sessionStatus, refresh } = useSession();
  const notation = useAnalysis((s) => s.notation);
  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState<Answer>({ status: "waiting" });

  useEffect(() => {
    hydratePreferences();
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (sessionStatus !== "ready" || !user) return;
    let cancelled = false;
    api.dueDrills().then(
      (r) =>
        !cancelled &&
        setLoad({ status: "ready", drills: r.drills, total: r.total, nextDueAt: r.nextDueAt }),
      () => !cancelled && setLoad({ status: "error" }),
    );
    return () => {
      cancelled = true;
    };
  }, [sessionStatus, user]);

  const drill = load.status === "ready" ? load.drills[index] : undefined;
  const color = drill?.fen.split(" ")[1] === "b" ? "b" : "w";
  const san = useCallback(
    (fen: string, uci: readonly string[], n = 5) =>
      numberLine(
        fen,
        uciLineToSan(fen, uci, n).map((s) => displaySan(s, notation)),
      ),
    [notation],
  );

  const finish = useCallback(
    async (uci: string | null, verdict: DrillVerdict, loss: number) => {
      if (!drill) return;
      setAnswer({ status: "done", uci, verdict, loss });
      try {
        await api.answerDrill(drill.id, verdict !== "wrong");
      } catch {
        /* the answer is shown anyway; it will simply be asked again */
      }
    },
    [drill],
  );

  const check = useCallback(
    async (uci: string) => {
      if (!drill) return;
      if (uci === drill.bestUci) return finish(uci, "best", 0);
      setAnswer({ status: "checking", uci });
      try {
        const { engine } = await getBrowserEngine();
        const after = fenAfterUci(drill.fen, uci);
        if (!after) return finish(uci, "wrong", 100);
        const best = await engine.analyse(drill.fen, DRILL_CHECK_DEPTH);
        const answerScore =
          terminalScore(after) ?? (await engine.analyse(after, DRILL_CHECK_DEPTH)).score;
        const g = gradeAnswer(color, uci, drill.bestUci, best.score, answerScore);
        return finish(uci, g.verdict, g.loss);
      } catch {
        return finish(uci, "wrong", 100);
      }
    },
    [drill, color, finish],
  );

  const options = useMemo(() => {
    const fen =
      answer.status === "waiting" || !drill
        ? drill?.fen
        : (fenAfterUci(drill.fen, answer.uci ?? "") ?? drill.fen);
    const arrows =
      answer.status === "done" && drill
        ? [
            {
              startSquare: drill.bestUci.slice(0, 2),
              endSquare: drill.bestUci.slice(2, 4),
              color: "rgba(47, 125, 225, 0.85)",
            },
          ]
        : [];
    return {
      id: "training-board",
      position: fen ?? undefined,
      boardOrientation: (color === "w" ? "white" : "black") as "white" | "black",
      allowDragging: answer.status === "waiting",
      allowDrawingArrows: false,
      arrows,
      lightSquareStyle: { backgroundColor: "var(--sq-light)" },
      darkSquareStyle: { backgroundColor: "var(--sq-dark)" },
      onPieceDrop: ({
        sourceSquare,
        targetSquare,
      }: {
        sourceSquare: string;
        targetSquare: string | null;
      }) => {
        if (!drill || !targetSquare || answer.status !== "waiting") return false;
        const g = new Chess(drill.fen);
        let move;
        try {
          move = g.move({ from: sourceSquare, to: targetSquare, promotion: "q" });
        } catch {
          return false;
        }
        void check(move.from + move.to + (move.promotion ?? ""));
        return true;
      },
    };
  }, [drill, answer, color, check]);

  if (sessionStatus !== "ready") return <p className="mt-6 text-muted">{t.loading}</p>;
  if (!user) {
    return (
      <div className="mt-6">
        <p>{t.loginNeeded}</p>
        <Link href="/cuenta" className="mt-3 inline-block underline">
          {t.goLogin}
        </Link>
      </div>
    );
  }
  if (load.status === "loading") return <p className="mt-6 text-muted">{t.loading}</p>;
  if (load.status === "error") {
    return (
      <p role="alert" className="mt-6 text-[var(--c-blunder)]">
        {t.error}
      </p>
    );
  }
  if (load.total === 0)
    return (
      <p className="mt-6" data-testid="train-empty">
        {t.none}
      </p>
    );
  if (!drill) {
    return (
      <p className="mt-6" data-testid="train-done">
        {t.allDone(load.nextDueAt ? dateFmt.format(new Date(load.nextDueAt)) : null)}
      </p>
    );
  }

  const moveNo = Number(drill.fen.split(" ")[5]) || 1;
  const played = san(drill.fen, [drill.playedUci], 1);
  const bestAfter = fenAfterUci(drill.fen, drill.bestUci);
  const continuation = bestAfter ? san(bestAfter, drill.bestPv.slice(1), 5) : "";

  return (
    <section
      className="mt-6 grid items-start gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]"
      data-testid="drill"
    >
      <div
        className="overflow-hidden rounded shadow-[0_8px_28px_rgba(60,40,20,0.18)]"
        data-testid="train-board"
        data-fen={drill.fen}
      >
        <Chessboard options={options} />
      </div>
      <div className="grid gap-3">
        <p className="text-sm text-muted">
          {t.progress(index + 1, load.drills.length)} · {t.box(Math.max(1, drill.box))}
        </p>
        <h2 className="text-xl font-bold">{t.prompt(color === "w" ? t.white : t.black)}</h2>
        <p className="text-sm text-muted">
          {t.fromGame(drill.white ?? "?", drill.black ?? "?", moveNo)}
        </p>

        {answer.status === "checking" && (
          <p aria-live="polite" data-testid="train-checking">
            {t.checking}
          </p>
        )}

        {answer.status === "done" && (
          <div
            aria-live="polite"
            className="grid gap-2"
            data-testid="train-result"
            data-verdict={answer.verdict}
          >
            <p
              className="text-lg font-bold"
              style={{ color: answer.verdict === "wrong" ? "var(--c-blunder)" : "var(--c-good)" }}
            >
              {answer.verdict === "best"
                ? t.correct
                : answer.verdict === "good-enough"
                  ? t.alsoGood
                  : t.wrong}
            </p>
            {answer.verdict === "wrong" && answer.uci && answer.loss < 100 && (
              <p className="text-sm text-muted">{t.lossNote(Math.round(answer.loss))}</p>
            )}
            <p>
              {t.solution} <b data-testid="train-solution">{san(drill.fen, [drill.bestUci], 1)}</b>
              {continuation && <span className="text-sm text-muted"> {continuation}</span>}
            </p>
            <p className="text-sm text-muted">
              {t.youPlayed} {played} (
              {messages.classes[drill.cls as "mistake" | "blunder"]?.label ?? drill.cls}).
            </p>
            <div>
              <Button
                variant="primary"
                data-testid="train-next"
                onClick={() => {
                  setAnswer({ status: "waiting" });
                  setIndex((i) => i + 1);
                }}
              >
                {t.next}
              </Button>
            </div>
          </div>
        )}

        {answer.status === "waiting" && (
          <div>
            <Button onClick={() => void finish(null, "wrong", 100)} data-testid="train-give-up">
              {t.showSolution}
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}
