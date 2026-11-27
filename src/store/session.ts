"use client";

import { create } from "zustand";
import { api, type ApiUser } from "@/lib/api-client";

interface SessionState {
  status: "unknown" | "loading" | "ready";
  user: ApiUser | null;
  /** Fetches the current user once (call again after login/logout to refresh). */
  refresh(force?: boolean): Promise<void>;
  setUser(user: ApiUser | null): void;
}

export const useSession = create<SessionState>()((set, get) => ({
  status: "unknown",
  user: null,
  refresh: async (force = false) => {
    if (!force && get().status !== "unknown") return;
    set({ status: "loading" });
    try {
      set({ user: await api.me(), status: "ready" });
    } catch {
      set({ user: null, status: "ready" });
    }
  },
  setUser: (user) => set({ user, status: "ready" }),
}));
