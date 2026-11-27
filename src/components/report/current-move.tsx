"use client";

import { formatScore } from "@/lib/chess/eval";
import { fenAfterUci, numberLine, uciLineToSan } from "@/lib/chess/line";
import { displaySan, type Notation } from "@/lib/chess/notation";
import { messages } from "@/messages/es";
import { useAnalysis } from "@/store/analysis";
import { useReport } from "@/store/use-report";
import { classColor } from "../ui";

const t = messages.analysis;

function line(fen: string, uci: readonly string[], notation: Notation) {
  return numberLine(
    fen,
    uciLineToSan(fen, uci, 5).map((s) => displaySan(s, notation)),
  );
}

/** "Mejor era **15… Dxd7** 16. Db8+ Re7 …": the alternative in bold, then its continuation. */
function BetterLine({
  fen,
  pv,
  notation,
}: {
  fen: string;
  pv: readonly string[];
  notation: Notation;
}) {
  const first = pv[0];
  if (!first) return null;
  const head = line(fen, [first], notation);
  const after = fenAfterUci(fen, first);
  const rest = after ? line(after, pv.slice(1, 5), notation) : "";
  return (
    <p>
      {t.betterWas} <b data-testid="better-move">{head}</b>{" "}
      {rest && <span className="text-sm text-muted">{rest}</span>}
    </p>
  );
}

export function CurrentMove() {
  const game = useAnalysis((s) => s.game);
  const ply = useAnalysis((s) => s.ply);
  const evals = useAnalysis((s) => s.evals);
  const notation = useAnalysis((s) => s.notation);
  const { classes } = useReport();
  if (!game) return null;

  const fen = game.fens[ply] ?? game.startFen;
  const e = evals[ply] ?? null;
  const last = ply > 0 ? game.moves[ply - 1] : undefined;
  const c = ply > 0 ? classes[ply - 1] : null;
  const prev = ply > 0 ? evals[ply - 1] : null;
  const showBetter =
    c && last && prev?.best && c.cls !== "best" && c.cls !== "forced" && c.cls !== "book";

  return (
    <section
      className="min-h-[96px] border-l-[3px] py-0.5 pl-3 text-[15px]"
      style={{ borderColor: classColor(c?.cls) }}
      aria-live="polite"
      data-testid="current-move"
    >
      <h2 className="text-[17px] font-bold">
        {last
          ? `${last.moveNumber}${last.color === "w" ? "." : "…"} ${displaySan(last.san, notation)}`
          : t.start}
      </h2>
      {c && (
        <p>
          <b style={{ color: classColor(c.cls) }} data-testid="current-class">
            {messages.classes[c.cls].label}
          </b>
          {c.reason && <span> · {t.reasons[c.reason]}</span>}
          {c.loss >= 1 && c.cls !== "forced" && c.cls !== "book" && (
            <span>
              {" "}
              · {t.lossPrefix} {c.loss.toFixed(0)} {t.lossSuffix}
            </span>
          )}
        </p>
      )}
      {showBetter && last && prev?.best && (
        <BetterLine
          fen={last.fenBefore}
          pv={prev.pv.length ? prev.pv : [prev.best]}
          notation={notation}
        />
      )}
      {e ? (
        <>
          <p className="text-sm text-muted">
            {t.evaluation} {formatScore(e.score)}
            {e.depth > 0 && ` · ${t.depthShort} ${e.depth}`}
          </p>
          {e.pv.length > 0 && (
            <p className="text-sm text-muted">
              {t.engineLine}: {line(fen, e.pv, notation)}
            </p>
          )}
        </>
      ) : (
        <p className="text-sm text-muted">{last ? t.pending : t.navHint}</p>
      )}
    </section>
  );
}
