import type { Metadata } from "next";
import { messages } from "@/messages/es";
import { AccountView } from "./account-view";

export const metadata: Metadata = { title: `${messages.account.title} · ${messages.app.title}` };

export default function AccountPage() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-8">
      <h1 className="text-3xl font-bold tracking-tight">{messages.account.title}</h1>
      <p className="mt-2 text-muted">{messages.account.intro}</p>
      <AccountView />
    </main>
  );
}
