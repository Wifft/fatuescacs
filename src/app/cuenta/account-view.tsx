"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { Button } from "@/components/ui";
import { api, ApiError } from "@/lib/api-client";
import { messages } from "@/messages/es";
import { useSession } from "@/store/session";

const t = messages.account;
type Mode = "login" | "register" | "recover";

const errorText = (e: unknown): string =>
  t.errors[e instanceof ApiError ? e.code : "unknown"] ?? t.errors.unknown ?? "Error";

function Field({
  label,
  help,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string; help?: string }) {
  const id = useId();
  return (
    <div className="grid gap-1">
      <label htmlFor={id} className="font-medium">
        {label}
      </label>
      <input
        id={id}
        required
        aria-describedby={help ? `${id}-help` : undefined}
        className="min-h-11 rounded-lg border border-line bg-soft px-3"
        {...props}
      />
      {help && (
        <p id={`${id}-help`} className="text-sm text-muted">
          {help}
        </p>
      )}
    </div>
  );
}

export function AccountView() {
  const { user, status, refresh, setUser } = useSession();
  const [mode, setMode] = useState<Mode>("login");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState<{ value: string; isNew: boolean } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const username = String(f.get("username") ?? "").trim();
    const password = String(f.get("password") ?? "");
    void run(async () => {
      if (mode === "login") setUser(await api.login(username, password));
      else if (mode === "register") {
        const r = await api.register(username, password);
        setCode({ value: r.recoveryCode, isNew: false });
        setUser(r.user);
      } else {
        const r = await api.recover(username, String(f.get("code") ?? ""), password);
        setCode({ value: r.recoveryCode, isNew: true });
        setUser(r.user);
      }
    });
  };

  if (code) {
    return (
      <section
        className="mt-6 rounded-xl border-2 border-[var(--c-inaccuracy)] p-5"
        aria-labelledby="code-title"
      >
        <h2 id="code-title" className="text-xl font-bold">
          {t.codeTitle}
        </h2>
        <p className="mt-2">{code.isNew ? t.codeNewText : t.codeText}</p>
        <p
          className="mt-4 rounded-lg bg-soft p-3 text-center font-mono text-xl tracking-wider select-all"
          data-testid="recovery-code"
        >
          {code.value}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(code.value);
                setCopied(true);
              } catch {
                /* clipboard unavailable: the code is selectable */
              }
            }}
          >
            {copied ? t.copied : t.copy}
          </Button>
          <Button variant="primary" onClick={() => setCode(null)} data-testid="code-saved">
            {t.codeSaved}
          </Button>
        </div>
      </section>
    );
  }

  if (status !== "ready") return <p className="mt-6 text-muted">{messages.history.loading}</p>;

  if (user) {
    return (
      <section className="mt-6 grid gap-4">
        <p data-testid="logged-in">{t.loggedInAs(user.username)}</p>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/historial"
            className="inline-flex min-h-11 items-center rounded-lg border border-foreground bg-foreground px-4 font-semibold text-background"
          >
            {t.goHistory}
          </Link>
          <Button
            disabled={busy}
            onClick={() =>
              run(async () => {
                await api.logout();
                setMode("login");
                setUser(null);
              })
            }
          >
            {t.logout}
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section className="mt-6">
      <div role="tablist" aria-label={t.title} className="flex flex-wrap gap-2">
        {(["login", "register", "recover"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => {
              setMode(m);
              setError(null);
            }}
            className={`min-h-11 rounded-lg border px-3 ${
              mode === m ? "border-foreground font-semibold" : "border-line bg-soft"
            }`}
          >
            {t[m]}
          </button>
        ))}
      </div>
      <form key={mode} onSubmit={onSubmit} className="mt-5 grid max-w-md gap-4" role="tabpanel">
        <Field
          label={t.username}
          name="username"
          autoComplete="username"
          help={mode === "register" ? t.usernameHelp : undefined}
          minLength={3}
          maxLength={30}
          data-testid="account-username"
        />
        {mode === "recover" && (
          <Field
            label={t.recoveryCode}
            name="code"
            autoComplete="off"
            spellCheck={false}
            data-testid="account-code"
          />
        )}
        <Field
          label={mode === "recover" ? t.newPassword : t.password}
          name="password"
          type="password"
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          help={mode === "login" ? undefined : t.passwordHelp}
          minLength={mode === "login" ? undefined : 8}
          data-testid="account-password"
        />
        {mode === "register" && <p className="text-sm text-muted">{t.noRecoveryWarning}</p>}
        {error && (
          <p role="alert" className="text-[var(--c-blunder-text)]" data-testid="account-error">
            {error}
          </p>
        )}
        <Button type="submit" variant="primary" disabled={busy} data-testid="account-submit">
          {t[mode]}
        </Button>
      </form>
    </section>
  );
}
