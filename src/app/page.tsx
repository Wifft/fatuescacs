import Link from "next/link";
import { messages } from "@/messages/es";
import { HomeForm } from "./home-form";

export default function Home() {
  const t = messages;
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-8">
      <h1 className="text-3xl font-bold tracking-tight">{t.app.title}</h1>
      <p className="mt-2 text-muted">{t.app.tagline}</p>
      <p className="mt-1 text-sm text-muted">{t.app.privacy}</p>
      <HomeForm />
      <Link href="/dev/engine" className="mt-10 inline-block text-sm text-muted underline">
        {t.home.engineTestLink}
      </Link>
    </main>
  );
}
