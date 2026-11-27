"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { PHASES, type Stats } from "@/lib/chess/stats";
import { messages } from "@/messages/es";
import { useSession } from "@/store/session";
import { openingNameEs } from "@/lib/chess/opening-names-es";

const t = messages.statsPage;
const pct = (x: number | null) =>
  x == null
    ? "–"
    : x.toLocaleString("es-ES", { maximumFractionDigits: 1, minimumFractionDigits: 1 });

type Load = { status: "loading" } | { status: "error" } | { status: "ready"; stats: Stats };

/** Ranked single-series bars: one hue, value in text ink, sorted high → low. */
function Bars({ title, rows }: { title: string; rows: [string, number][] }) {
  const sorted = rows.filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...sorted.map(([, n]) => n));
  return (
    <section className="rounded-xl border border-line p-4">
      <h3 className="mb-3 font-semibold">{title}</h3>
      {sorted.length === 0 ? (
        <p className="text-sm text-muted">–</p>
      ) : (
        <ul className="grid gap-2.5">
          {sorted.map(([label, n]) => (
            <li
              key={label}
              className="grid grid-cols-[minmax(0,10rem)_1fr_2.5rem] items-center gap-3 text-sm"
            >
              <span className="truncate">{label}</span>
              <span className="h-2.5 rounded-r bg-soft" aria-hidden>
                <span
                  className="block h-full rounded-r"
                  style={{ width: `${(n / max) * 100}%`, background: "var(--accent)" }}
                />
              </span>
              <span className="text-right font-semibold tabular-nums">{n}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function StatsView() {
  const { user, status: sessionStatus, refresh } = useSession();
  const [load, setLoad] = useState<Load>({ status: "loading" });

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (sessionStatus !== "ready" || !user) return;
    let cancelled = false;
    api.stats().then(
      (stats) => !cancelled && setLoad({ status: "ready", stats }),
      () => !cancelled && setLoad({ status: "error" }),
    );
    return () => {
      cancelled = true;
    };
  }, [sessionStatus, user]);

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
      <p role="alert" className="mt-6 text-[var(--c-blunder-text)]">
        {t.error}
      </p>
    );
  }
  const s = load.stats;
  if (s.games === 0)
    return (
      <p className="mt-6" data-testid="stats-empty">
        {t.empty}
      </p>
    );

  const worst = s.openings.slice(0, 5);
  return (
    <div className="mt-6 grid gap-10" data-testid="stats">
      <p className="text-muted">{t.summary(s.games, s.moves)}</p>

      <section>
        <h2 className="mb-3 text-xl font-semibold">{t.phasesTitle}</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {PHASES.map((p) => {
            const ph = s.phases[p];
            return (
              <div key={p} className="rounded-xl bg-soft px-4 py-3" data-testid={`phase-${p}`}>
                <p className="text-sm text-muted">{t.phases[p]}</p>
                <p className="text-4xl leading-tight font-bold proportional-nums">
                  {pct(ph.accuracy)}
                  {ph.accuracy != null && (
                    <span className="text-lg font-normal text-muted"> %</span>
                  )}
                </p>
                <p className="text-sm text-muted">
                  {t.moves}: {ph.moves} · ?! {ph.inaccuracy} · ? {ph.mistake} · ?? {ph.blunder}
                </p>
              </div>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-muted">{t.phaseNote}</p>
      </section>

      <section>
        <h2 className="mb-3 text-xl font-semibold">{t.openingsTitle}</h2>
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="w-full text-left text-sm" data-testid="openings-table">
            <thead className="bg-soft text-muted">
              <tr>
                <th className="px-3 py-2 font-medium">{t.opening}</th>
                <th className="px-3 py-2 text-right font-medium">{t.games}</th>
                <th className="px-3 py-2 text-right font-medium">{t.record}</th>
                <th className="px-3 py-2 text-right font-medium">{t.score}</th>
                <th className="px-3 py-2 text-right font-medium">{t.accuracy}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line tabular-nums">
              {worst.map((o) => (
                <tr key={`${o.eco}|${o.name}`}>
                  <td className="max-w-[22rem] truncate px-3 py-2">
                    {o.eco && o.name ? `${o.eco} · ${openingNameEs(o.name)}` : t.unknownOpening}
                  </td>
                  <td className="px-3 py-2 text-right">{o.games}</td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    {o.wins} / {o.draws} / {o.losses}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {o.score == null ? "–" : `${pct(o.score * 100)} %`}
                  </td>
                  <td className="px-3 py-2 text-right">{pct(o.accuracy)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-1 text-xl font-semibold">{t.errorsTitle}</h2>
        <p className="mb-3 text-sm text-muted">{t.errorsNote(s.errors.total)}</p>
        <div className="grid gap-3 lg:grid-cols-3">
          <Bars
            title={t.byKind}
            rows={Object.entries(t.kinds).map(([k, label]) => [
              label,
              s.errors.byKind[k as keyof typeof t.kinds] ?? 0,
            ])}
          />
          <Bars title={t.byPhase} rows={PHASES.map((p) => [t.phases[p], s.errors.byPhase[p]])} />
          <Bars
            title={t.byPiece}
            rows={(Object.keys(t.pieces) as (keyof typeof t.pieces)[]).map((p) => [
              t.pieces[p],
              s.errors.byPiece[p],
            ])}
          />
        </div>
      </section>
    </div>
  );
}
