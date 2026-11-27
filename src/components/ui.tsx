import type { ButtonHTMLAttributes, SelectHTMLAttributes } from "react";

const base =
  "inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border px-3 text-base disabled:cursor-default disabled:opacity-50";

export function Button({
  variant = "default",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "default" | "primary" }) {
  const look =
    variant === "primary"
      ? "border-foreground bg-foreground font-semibold text-background hover:opacity-90"
      : "border-line bg-soft hover:border-muted";
  return <button type="button" className={`${base} ${look} ${className}`} {...props} />;
}

export function Select({ className = "", ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={`min-h-11 rounded-lg border border-line bg-soft px-2 text-base ${className}`}
      {...props}
    />
  );
}

/** CSS variable holding the colour of a move class (marks: dots, borders, bars). */
export const classColor = (cls: string | undefined) => (cls ? `var(--c-${cls})` : "var(--line)");

/** Text-safe (WCAG AA) variant of a move-class colour. */
export const classTextColor = (cls: string | undefined) =>
  cls ? `var(--c-${cls}-text)` : "var(--foreground)";
