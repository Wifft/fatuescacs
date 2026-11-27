"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { Button, Select } from "@/components/ui";
import { parsePgn, PgnError } from "@/lib/chess/pgn";
import { OPERA_GAME_PGN } from "@/lib/chess/samples";
import { analysisHref } from "@/lib/share";
import { messages, pgnErrorMessage } from "@/messages/es";
import { DEPTH_OPTIONS, hydratePreferences, useAnalysis } from "@/store/analysis";

const t = messages.home;
const DRAFT_KEY = "pgn-draft";

export function HomeForm() {
  const router = useRouter();
  const depth = useAnalysis((s) => s.depth);
  const setDepth = useAnalysis((s) => s.setDepth);
  const [pgn, setPgn] = useState(OPERA_GAME_PGN);
  const [error, setError] = useState<string | null>(null);
  const ids = { pgn: useId(), depth: useId(), help: useId(), err: useId() };

  useEffect(() => {
    hydratePreferences();
    try {
      const draft = localStorage.getItem(DRAFT_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- restore a per-viewer draft once
      if (draft) setPgn(draft);
    } catch {
      /* no storage: keep the sample */
    }
  }, []);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      parsePgn(pgn);
    } catch (err) {
      setError(err instanceof PgnError ? pgnErrorMessage(err) : String(err));
      return;
    }
    setError(null);
    try {
      localStorage.setItem(DRAFT_KEY, pgn);
    } catch {
      /* ignore */
    }
    router.push(analysisHref(pgn));
  };

  return (
    <form onSubmit={submit} className="mt-8 grid gap-3" noValidate>
      <label htmlFor={ids.pgn} className="font-semibold">
        {t.pgnLabel}
      </label>
      <p id={ids.help} className="-mt-2 text-sm text-muted">
        {t.pgnHelp}
      </p>
      <textarea
        id={ids.pgn}
        value={pgn}
        onChange={(e) => setPgn(e.target.value)}
        spellCheck={false}
        rows={10}
        aria-describedby={`${ids.help}${error ? ` ${ids.err}` : ""}`}
        aria-invalid={error ? true : undefined}
        className="w-full resize-y rounded-lg border border-line bg-soft p-2.5 font-mono text-sm"
        data-testid="pgn-input"
      />
      {error && (
        <p
          id={ids.err}
          role="alert"
          className="text-sm text-[var(--c-blunder)]"
          data-testid="pgn-error"
        >
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2.5">
        <label htmlFor={ids.depth}>{t.depthLabel}</label>
        <Select id={ids.depth} value={depth} onChange={(e) => setDepth(Number(e.target.value))}>
          {DEPTH_OPTIONS.map((d) => (
            <option key={d} value={d}>
              {messages.depth[d]}
            </option>
          ))}
        </Select>
        <Button type="submit" variant="primary" data-testid="analyze">
          {t.analyze}
        </Button>
        <Button
          onClick={() => {
            setPgn(OPERA_GAME_PGN);
            setError(null);
          }}
        >
          {t.loadSample}
        </Button>
      </div>
      <p className="text-sm text-muted">{t.sampleNote}</p>
    </form>
  );
}
