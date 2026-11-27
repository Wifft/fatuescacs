import type { Metadata } from "next";
import { messages } from "@/messages/es";
import { TrainView } from "./train-view";

export const metadata: Metadata = { title: `${messages.train.title} · ${messages.app.title}` };

export default function TrainPage() {
  return (
    <main className="mx-auto w-full max-w-[1100px] flex-1 px-4 py-10 sm:px-8">
      <h1 className="text-3xl font-bold tracking-tight">{messages.train.title}</h1>
      <p className="mt-2 max-w-2xl text-muted">{messages.train.intro}</p>
      <TrainView />
    </main>
  );
}
