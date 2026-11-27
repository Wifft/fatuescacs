import Link from "next/link";
import { messages } from "@/messages/es";
import { EngineProbe } from "./engine-probe";

export const metadata = { title: messages.engineTest.title };

export default function EngineTestPage() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12 sm:px-8">
      <h1 className="text-2xl font-bold tracking-tight">{messages.engineTest.title}</h1>
      <EngineProbe />
      <Link href="/" className="mt-8 inline-block text-sm text-muted underline">
        {messages.engineTest.back}
      </Link>
    </main>
  );
}
