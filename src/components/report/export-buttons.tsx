"use client";

import { useState } from "react";
import { messages } from "@/messages/es";
import { useAnalysis } from "@/store/analysis";
import { useReport } from "@/store/use-report";
import { Button } from "../ui";
import { reportCardBlob, type ReportCardData } from "./report-card";
import { openingNameEs } from "@/lib/chess/opening-names-es";

const t = messages.exportReport;
const fmt = (x: number | null | undefined) =>
  x == null
    ? "–"
    : x.toLocaleString("es-ES", { maximumFractionDigits: 1, minimumFractionDigits: 1 });

const fileName = (title: string) =>
  `analisis-${
    title
      .normalize("NFD")
      .replace(/\p{M}/gu, "") // strip accents
      .replace(/[^a-z0-9]+/gi, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase()
      .slice(0, 60) || "partida"
  }.png`;

export function ExportButtons() {
  const game = useAnalysis((s) => s.game);
  const evals = useAnalysis((s) => s.evals);
  const opening = useAnalysis((s) => s.opening?.opening);
  const done = useAnalysis((s) => s.progress?.phase === "done");
  const { classes, accuracy, counts } = useReport();
  const [state, setState] = useState<"idle" | "busy" | "copied" | "error">("idle");

  // Rendered (disabled) before the game loads so the header keeps its height (no layout shift).
  const h = game?.headers ?? {};
  const title = `${h.White ?? messages.analysis.white} – ${h.Black ?? messages.analysis.black}`;

  const cardData = (): ReportCardData => ({
    title,
    subtitle: [h.Event, h.Date?.replace(/\.\?\?/g, ""), h.Result].filter(Boolean).join(" · "),
    opening: opening ? `${opening.eco} · ${openingNameEs(opening.name)}` : null,
    players: (["w", "b"] as const).map((c) => ({
      name:
        (c === "w" ? h.White : h.Black) ??
        (c === "w" ? messages.analysis.white : messages.analysis.black),
      accuracy: fmt(accuracy?.[c]),
      counts: t.counts(counts[c].inaccuracy, counts[c].mistake, counts[c].blunder),
    })),
    scores: evals.map((e) => e?.score ?? null),
    marks: classes.flatMap((c, i) =>
      c && (c.cls === "inaccuracy" || c.cls === "mistake" || c.cls === "blunder")
        ? [{ index: i + 1, cls: c.cls }]
        : [],
    ),
    footer: t.footer(window.location.host),
  });

  const download = async () => {
    setState("busy");
    try {
      const blob = await reportCardBlob(cardData());
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName(title);
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setState("idle");
    } catch {
      setState("error");
    }
  };

  const share = async () => {
    const url = window.location.href;
    try {
      if (typeof navigator.share === "function") {
        const blob = await reportCardBlob(cardData()).catch(() => null);
        const file = blob ? new File([blob], fileName(title), { type: "image/png" }) : null;
        const withFile = file && navigator.canShare?.({ files: [file] });
        await navigator.share({ title, url, ...(withFile ? { files: [file] } : {}) });
        return;
      }
      await navigator.clipboard.writeText(url);
      setState("copied");
      setTimeout(() => setState("idle"), 2000);
    } catch (err) {
      // The user closing the share sheet is not an error.
      if ((err as Error)?.name !== "AbortError") setState("error");
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button onClick={share} disabled={!game} data-testid="share">
        {state === "copied" ? messages.analysis.copied : t.share}
      </Button>
      <Button
        onClick={download}
        disabled={!game || !done || state === "busy"}
        title={done ? undefined : t.waitAnalysis}
        data-testid="download-image"
      >
        {t.download}
      </Button>
      {state === "error" && (
        <span role="alert" className="text-sm text-[var(--c-blunder-text)]">
          {t.error}
        </span>
      )}
    </div>
  );
}
