import type { Metadata } from "next";
import { messages } from "@/messages/es";
import { ImportView } from "./import-view";

export const metadata: Metadata = { title: `${messages.importPage.title} · ${messages.app.title}` };

export default function ImportPage() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-8">
      <h1 className="text-3xl font-bold tracking-tight">{messages.importPage.title}</h1>
      <p className="mt-2 text-muted">{messages.importPage.intro}</p>
      <ImportView />
    </main>
  );
}
