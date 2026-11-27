"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { messages } from "@/messages/es";

const t = messages.nav;
const LINKS = [
  { href: "/", label: t.home },
  { href: "/import", label: t.import },
  { href: "/historial", label: t.history },
  { href: "/entrenar", label: t.train },
  { href: "/estadisticas", label: t.stats },
  { href: "/cuenta", label: t.account },
] as const;

export function SiteNav() {
  const path = usePathname();
  return (
    <nav aria-label={t.label} className="border-b border-line">
      <ul className="mx-auto flex max-w-[1240px] flex-wrap items-center gap-1 px-4 py-2 sm:px-[4vw]">
        <li className="w-full font-bold sm:mr-auto sm:w-auto">
          <Link href="/" className="inline-flex min-h-11 items-center">
            ♞ {messages.app.title}
          </Link>
        </li>
        {LINKS.map(({ href, label }) => {
          const active =
            href === "/" ? path === "/" || path === "/analysis" : path.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`inline-flex min-h-11 items-center rounded-lg px-3 ${
                  active ? "bg-soft font-semibold" : "text-muted hover:text-foreground"
                }`}
              >
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
