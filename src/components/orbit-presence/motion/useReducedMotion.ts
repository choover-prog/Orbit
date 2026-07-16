"use client";

import { useSyncExternalStore } from "react";

export function useReducedMotion(simulated = false): boolean {
  return useSyncExternalStore(
    (callback) => {
      if (simulated) return () => undefined;
      const query = window.matchMedia("(prefers-reduced-motion: reduce)");
      query.addEventListener("change", callback);
      return () => query.removeEventListener("change", callback);
    },
    () =>
      simulated ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => simulated,
  );
}
