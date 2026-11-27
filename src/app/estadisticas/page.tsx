import type { Metadata } from "next";
import { messages } from "@/messages/es";
import { StatsView } from "./stats-view";

export const metadata: Metadata = { title: `${messages.statsPage.title} · ${messages.app.title}` };

export default function StatsPage() {
  return (
    <main className="mx-auto w-full max-w-[1100px] flex-1 px-4 py-10 sm:px-8">
      <h1 className="text-3xl font-bold tracking-tight">{messages.statsPage.title}</h1>
      <p className="mt-2 max-w-2xl text-muted">{messages.statsPage.intro}</p>
      <StatsView />
    </main>
  );
}
