"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * False during SSR and the hydration render, true afterwards. Forms use it to stay disabled
 * until React handles them: before hydration a submit would be a native GET (reloading the
 * page, or even putting a password in the URL) and typed text could be mangled.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
