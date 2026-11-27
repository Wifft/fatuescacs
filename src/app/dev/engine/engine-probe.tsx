"use client";

import { useEffect, useState } from "react";
import { bootEngine, type BootedEngine } from "@/lib/engine/boot";
import { messages } from "@/messages/es";

type ProbeState =
  | { status: "loading" }
  | { status: "ready"; engine: Omit<BootedEngine, "worker"> }
  | { status: "error"; detail: string };

const t = messages.engineTest;
const fmtSeconds = (ms: number) =>
  `${(ms / 1000).toLocaleString("es-ES", { maximumFractionDigits: 2 })} s`;

export function EngineProbe() {
  const [state, setState] = useState<ProbeState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    let worker: Worker | null = null;
    bootEngine().then(
      (engine) => {
        worker = engine.worker;
        if (cancelled) {
          worker.terminate();
          return;
        }
        const { name, build, loadMs } = engine;
        setState({ status: "ready", engine: { name, build, loadMs } });
      },
      (err: unknown) => {
        if (!cancelled) setState({ status: "error", detail: String(err) });
      },
    );
    return () => {
      cancelled = true;
      worker?.terminate();
    };
  }, []);

  const statusText =
    state.status === "loading" ? t.loading : state.status === "ready" ? t.ready : t.error;

  return (
    <div className="mt-6 grid gap-4">
      <dl className="grid grid-cols-1 overflow-hidden rounded-lg border border-line sm:grid-cols-2">
        <Row label={t.status} value={statusText} testId="engine-status" />
        {state.status === "ready" && (
          <>
            <Row label={t.name} value={state.engine.name || "Stockfish"} testId="engine-name" />
            <Row
              label={t.build}
              value={state.engine.build === "wasm" ? t.buildWasm : t.buildAsm}
              testId="engine-build"
            />
            <Row label={t.loadTime} value={fmtSeconds(state.engine.loadMs)} testId="engine-load" />
          </>
        )}
      </dl>
      {state.status === "ready" && state.engine.build === "asm" && (
        <p role="status" className="text-sm text-muted">
          {t.slowMode}
        </p>
      )}
      {state.status === "error" && (
        <p role="alert" className="font-mono text-sm text-muted">
          {state.detail}
        </p>
      )}
    </div>
  );
}

function Row({ label, value, testId }: { label: string; value: string; testId: string }) {
  return (
    <div className="border-line p-3 shadow-[0_0_0_0.5px_var(--line)]">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="text-lg font-semibold" data-testid={testId} aria-live="polite">
        {value}
      </dd>
    </div>
  );
}
