"use client";

import { useEffect, useSyncExternalStore } from "react";
import { messages } from "@/messages/es";

const subscribe = (cb: () => void) => {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
};

/** Registers the service worker (production only) and shows a notice while offline. */
export function Pwa() {
  const online = useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );

  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      /* the app works without it */
    });
  }, []);

  if (online) return null;
  return (
    <p
      role="status"
      className="border-b border-line bg-soft px-4 py-2 text-center text-sm"
      data-testid="offline-banner"
    >
      {messages.pwa.offline}
    </p>
  );
}
