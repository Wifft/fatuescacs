"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { Button } from "@/components/ui";
import { identifyOpening, loadOpeningTable, type OpeningTable } from "@/lib/chess/openings";
import { parsePgn } from "@/lib/chess/pgn";
import { importChesscom } from "@/lib/import/chesscom";
import { ImportError, PoliteHttp } from "@/lib/import/http";
import { importLichess } from "@/lib/import/lichess";
import { userOutcome, type ImportedGame, type ImportSource } from "@/lib/import/types";
import { analysisHref } from "@/lib/share";
import { messages } from "@/messages/es";

const t = messages.importPage;
const PREF_KEY = "import-last";
const http = new PoliteHttp();

type State =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "done"; games: ImportedGame[] };

function openingOf(g: ImportedGame, table: OpeningTable | null): string | null {
  if (table) {
    try {
      const o = identifyOpening(parsePgn(g.pgn).fens, table).opening;
      if (o) return `${o.eco} · ${o.name}`;
    } catch {
      /* fall back to the site's opening */
    }
  }
  return g.siteOpening ? [g.siteOpening.eco, g.siteOpening.name].filter(Boolean).join(" · ") : null;
}

const dateFmt = new Intl.DateTimeFormat("es-ES", { dateStyle: "medium" });

export function ImportView() {
  const [source, setSource] = useState<ImportSource>("lichess");
  const [username, setUsername] = useState("");
  const [state, setState] = useState<State>({ status: "idle" });
  const [table, setTable] = useState<OpeningTable | null>(null);
  const ids = { user: useId(), err: useId() };

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(PREF_KEY) ?? "null") as {
        source: ImportSource;
        username: string;
      } | null;
      if (saved) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- restore per-viewer prefs once
        setSource(saved.source === "chesscom" ? "chesscom" : "lichess");
        setUsername(saved.username ?? "");
      }
    } catch {
      /* no storage */
    }
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = username.trim();
    setState({ status: "loading" });
    try {
      localStorage.setItem(PREF_KEY, JSON.stringify({ source, username: name }));
    } catch {
      /* ignore */
    }
    try {
      const games =
        source === "lichess" ? await importLichess(name, http) : await importChesscom(name, http);
      setState({ status: "done", games });
      loadOpeningTable().then(setTable, () => undefined);
    } catch (err) {
      const message =
        err instanceof ImportError ? t.errors[err.kind] : messages.importPage.errors.network;
      setState({ status: "error", message });
    }
  };

  return (
    <>
      <form onSubmit={submit} className="mt-6 flex flex-wrap items-end gap-3" noValidate>
        <fieldset className="flex gap-2">
          <legend className="mb-1 text-sm text-muted">{t.source}</legend>
          {(["lichess", "chesscom"] as const).map((s) => (
            <label
              key={s}
              className={`inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 ${
                source === s ? "border-foreground" : "border-line bg-soft"
              }`}
            >
              <input
                type="radio"
                name="source"
                value={s}
                checked={source === s}
                onChange={() => setSource(s)}
              />
              {t[s]}
            </label>
          ))}
        </fieldset>
        <div className="grid gap-1">
          <label htmlFor={ids.user} className="text-sm text-muted">
            {t.username}
          </label>
          <input
            id={ids.user}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="off"
            spellCheck={false}
            required
            aria-describedby={state.status === "error" ? ids.err : undefined}
            className="min-h-11 rounded-lg border border-line bg-soft px-3"
            data-testid="import-username"
          />
        </div>
        <Button
          type="submit"
          variant="primary"
          disabled={state.status === "loading" || !username.trim()}
          data-testid="import-submit"
        >
          {state.status === "loading" ? t.loading : t.submit}
        </Button>
      </form>
      <p className="mt-2 text-sm text-muted">{t.variantsNote}</p>

      {state.status === "error" && (
        <p
          id={ids.err}
          role="alert"
          className="mt-4 text-[var(--c-blunder)]"
          data-testid="import-error"
        >
          {state.message}
        </p>
      )}

      {state.status === "done" && (
        <section className="mt-6">
          <h2 className="mb-2 font-semibold" aria-live="polite">
            {t.count(state.games.length)}
          </h2>
          <ul
            aria-label={t.listLabel}
            className="divide-y divide-line rounded-xl border border-line"
          >
            {state.games.map((g) => (
              <GameRow key={g.id} game={g} opening={openingOf(g, table)} />
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

function GameRow({ game: g, opening }: { game: ImportedGame; opening: string | null }) {
  const outcome = userOutcome(g);
  const opponent = g.userColor === "b" ? g.white : g.black;
  const me = g.userColor === "b" ? g.black : g.white;
  const outcomeText =
    outcome === "win"
      ? t.win
      : outcome === "loss"
        ? t.loss
        : outcome === "draw"
          ? t.draw
          : t.unfinished;
  const outcomeColor =
    outcome === "win" ? "var(--c-good)" : outcome === "loss" ? "var(--c-blunder)" : "var(--muted)";
  return (
    <li
      className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3.5 py-3"
      data-testid="imported-game"
    >
      <div className="min-w-0 flex-1">
        <p className="truncate">
          <b style={{ color: outcomeColor }}>{outcomeText}</b> {t.vs}{" "}
          <span className="font-semibold">{opponent.name}</span>
          {opponent.rating !== null && <span className="text-muted"> ({opponent.rating})</span>}
          {g.userColor === null && (
            <span className="text-muted">
              {" "}
              · {me.name} – {opponent.name}
            </span>
          )}
        </p>
        <p className="truncate text-sm text-muted">
          {[
            dateFmt.format(new Date(g.playedAt)),
            g.speed ? t.speeds[g.speed] : null,
            g.timeControl,
            g.result,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
        {opening && <p className="truncate text-sm text-muted">{opening}</p>}
      </div>
      <Link
        href={analysisHref(g.pgn)}
        className="inline-flex min-h-11 items-center rounded-lg border border-foreground bg-foreground px-4 font-semibold text-background"
      >
        {t.analyze}
      </Link>
    </li>
  );
}
