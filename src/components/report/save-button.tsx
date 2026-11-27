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
type ColorChoice = "w" | "b" | "none" | null;

/** Guesses the user's colour from the last imported username (set on the import page). */
function guessColor(white?: string, black?: string): ColorChoice {
  try {
    const last = JSON.parse(localStorage.getItem("import-last") ?? "null") as {
      username?: string;
    } | null;
    const u = last?.username?.toLowerCase();
    if (!u) return null;
    if (white?.toLowerCase() === u) return "w";
    if (black?.toLowerCase() === u) return "b";
  } catch {
    /* no storage */
  }
  return null;
}

export function SaveButton() {
  const { user, status, refresh } = useSession();
  const pgn = useAnalysis((s) => s.pgn);
  const evals = useAnalysis((s) => s.evals);
  const headers = useAnalysis((s) => s.game?.headers);
  const done = useAnalysis((s) => s.progress?.phase === "done");
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [color, setColor] = useState<ColorChoice>(null);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // A new game or a new analysis can be saved again.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset when the analysis changes
    setState("idle");
  }, [pgn, evals]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- preselect once per game
    setColor(guessColor(headers?.White, headers?.Black));
  }, [pgn, headers?.White, headers?.Black]);

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
    if (!s.pgn || color === null) return;
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
        userColor: color === "none" ? null : color,
      });
      setState("saved");
    } catch {
      setState("error");
    }
  };

  const options: [Exclude<ColorChoice, null>, string][] = [
    ["w", `${t.colorWhite}${headers?.White ? ` (${headers.White})` : ""}`],
    ["b", `${t.colorBlack}${headers?.Black ? ` (${headers.Black})` : ""}`],
    ["none", t.colorNone],
  ];

  return (
    <div className="grid gap-2 rounded-xl border border-line p-3">
      <fieldset>
        <legend className="text-sm font-semibold">{t.colorLegend}</legend>
        <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
          {options.map(([value, label]) => (
            <label key={value} className="inline-flex min-h-9 items-center gap-2 text-[15px]">
              <input
                type="radio"
                name="user-color"
                value={value}
                checked={color === value}
                onChange={() => {
                  setColor(value);
                  setState("idle");
                }}
              />
              <span className="max-w-[16ch] truncate">{label}</span>
            </label>
          ))}
        </div>
        <p className="mt-1 text-xs text-muted">{t.colorHelp}</p>
      </fieldset>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          onClick={save}
          disabled={!complete || color === null || state === "saving" || state === "saved"}
          title={!complete ? t.waitAnalysis : color === null ? t.chooseColor : undefined}
          data-testid="save-analysis"
        >
          {state === "saving" ? t.saving : state === "saved" ? t.saved : t.save}
        </Button>
        {state === "error" && (
          <span role="alert" className="text-sm text-[var(--c-blunder-text)]">
            {t.error}
          </span>
        )}
        <span className="sr-only" aria-live="polite">
          {state === "saved" ? t.saved : ""}
        </span>
      </div>
    </div>
  );
}
