"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui";
import { api, type SavedAnalysisSummary } from "@/lib/api-client";
import { parsePgn } from "@/lib/chess/pgn";
import { analysisHref } from "@/lib/share";
import { messages } from "@/messages/es";
import { useAnalysis } from "@/store/analysis";
import { getEvalCache } from "@/store/run-analysis";
import { useSession } from "@/store/session";

const t = messages.history;
const dateFmt = new Intl.DateTimeFormat("es-ES", { dateStyle: "medium" });
const pct = (x: number | null) =>
  x == null
    ? "–"
    : x.toLocaleString("es-ES", { maximumFractionDigits: 1, minimumFractionDigits: 1 });

type State =
  { status: "loading" } | { status: "error" } | { status: "ready"; items: SavedAnalysisSummary[] };

export function HistoryView() {
  const router = useRouter();
  const { user, status: sessionStatus, refresh } = useSession();
  const [state, setState] = useState<State>({ status: "loading" });
  const [confirming, setConfirming] = useState<number | null>(null);
  const [opening, setOpening] = useState<number | null>(null);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (sessionStatus !== "ready" || !user) return;
    let cancelled = false;
    api.listAnalyses().then(
      (items) => !cancelled && setState({ status: "ready", items }),
      () => !cancelled && setState({ status: "error" }),
    );
    return () => {
      cancelled = true;
    };
  }, [sessionStatus, user]);

  /** Loads the saved evaluations into the cache so the analysis opens instantly. */
  const open = async (id: number) => {
    setOpening(id);
    try {
      const a = await api.getAnalysis(id);
      const { fens } = parsePgn(a.pgn);
      const cache = getEvalCache();
      await Promise.all(a.evals.map((e, i) => cache.set(fens[i] as string, a.depth, e)));
      useAnalysis.getState().setDepth(a.depth);
      router.push(analysisHref(a.pgn));
    } catch {
      setOpening(null);
      setState({ status: "error" });
    }
  };

  const remove = async (id: number) => {
    if (confirming !== id) {
      setConfirming(id);
      return;
    }
    setConfirming(null);
    try {
      await api.deleteAnalysis(id);
      setState((s) =>
        s.status === "ready" ? { status: "ready", items: s.items.filter((i) => i.id !== id) } : s,
      );
    } catch {
      setState({ status: "error" });
    }
  };

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
  if (state.status === "loading") return <p className="mt-6 text-muted">{t.loading}</p>;
  if (state.status === "error") {
    return (
      <p role="alert" className="mt-6 text-[var(--c-blunder-text)]">
        {t.error}
      </p>
    );
  }
  if (state.items.length === 0) return <p className="mt-6">{t.empty}</p>;

  return (
    <ul
      className="mt-6 divide-y divide-line rounded-xl border border-line"
      data-testid="history-list"
    >
      {state.items.map((a) => (
        <li
          key={a.id}
          className="flex flex-wrap items-center gap-x-4 gap-y-2 px-3.5 py-3"
          data-testid="history-item"
        >
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">
              {a.white ?? messages.analysis.white} – {a.black ?? messages.analysis.black}
              {a.result && <span className="font-normal text-muted"> · {a.result}</span>}
            </p>
            {a.opening && (
              <p className="truncate text-sm text-muted">
                {a.opening.eco} · {a.opening.name}
              </p>
            )}
            <p className="text-sm text-muted">
              {pct(a.accuracy.w)} % / {pct(a.accuracy.b)} % · {t.depth(a.depth)} ·{" "}
              {t.savedOn(dateFmt.format(new Date(a.updatedAt)))}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="primary" onClick={() => open(a.id)} disabled={opening !== null}>
              {opening === a.id ? t.loading : t.open}
            </Button>
            <Button onClick={() => remove(a.id)} onBlur={() => setConfirming(null)}>
              {confirming === a.id ? t.removeConfirm : t.remove}
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}
