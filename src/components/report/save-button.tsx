"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import type { PositionEval } from "@/lib/engine/uci";
import { messages } from "@/messages/es";
import { useAnalysis } from "@/store/analysis";
import { useSession } from "@/store/session";
import { Button } from "../ui";

const t = messages.save;

export function SaveButton() {
  const { user, status, refresh } = useSession();
  const pgn = useAnalysis((s) => s.pgn);
  const evals = useAnalysis((s) => s.evals);
  const done = useAnalysis((s) => s.progress?.phase === "done");
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // A new game or a new analysis can be saved again.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset when the analysis changes
    setState("idle");
  }, [pgn, evals]);

  if (status !== "ready") return null;
  if (!user) {
    return (
      <Link href="/cuenta" className="text-sm text-muted underline">
        {t.loginToSave}
      </Link>
    );
  }

  const complete = done && evals.length > 0 && evals.every(Boolean);
  const save = async () => {
    const s = useAnalysis.getState();
    if (!s.pgn) return;
    setState("saving");
    try {
      await api.saveAnalysis({
        pgn: s.pgn,
        depth: s.depth,
        evals: s.evals as PositionEval[],
        bookPlies: s.opening?.bookPlies ?? 0,
        opening: s.opening?.opening
          ? { eco: s.opening.opening.eco, name: s.opening.opening.name }
          : null,
      });
      setState("saved");
    } catch {
      setState("error");
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        onClick={save}
        disabled={!complete || state === "saving" || state === "saved"}
        title={complete ? undefined : t.waitAnalysis}
        data-testid="save-analysis"
      >
        {state === "saving" ? t.saving : state === "saved" ? t.saved : t.save}
      </Button>
      {state === "error" && (
        <span role="alert" className="text-sm text-[var(--c-blunder)]">
          {t.error}
        </span>
      )}
      <span className="sr-only" aria-live="polite">
        {state === "saved" ? t.saved : ""}
      </span>
    </div>
  );
}
