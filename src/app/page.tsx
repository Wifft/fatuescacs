import Link from "next/link";
import { messages } from "@/messages/es";

export default function Home() {
  const t = messages;
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12 sm:px-8">
      <h1 className="text-3xl font-bold tracking-tight">{t.app.title}</h1>
      <p className="mt-2 text-muted">{t.app.tagline}</p>
      <p className="mt-6 text-sm text-muted">{t.home.phaseNote}</p>
      <Link
        href="/dev/engine"
        className="mt-6 inline-flex min-h-11 items-center rounded-lg bg-foreground px-4 font-semibold text-background focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        {t.home.engineTestLink}
      </Link>
    </main>
  );
}
