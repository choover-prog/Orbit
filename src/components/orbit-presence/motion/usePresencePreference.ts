"use client";

import { useCallback, useSyncExternalStore } from "react";
import type { OrbitPresenceVariant } from "../OrbitPresence.types";
import { presenceVariants } from "../OrbitPresence.types";

const STORAGE_KEY = "orbit.presence.variant";
const CHANGE_EVENT = "orbit-presence-change";

export function usePresencePreference(
  initial: OrbitPresenceVariant = "hybrid",
) {
  const variant = useSyncExternalStore(
    (callback) => {
      window.addEventListener("storage", callback);
      window.addEventListener("popstate", callback);
      window.addEventListener(CHANGE_EVENT, callback);
      return () => {
        window.removeEventListener("storage", callback);
        window.removeEventListener("popstate", callback);
        window.removeEventListener(CHANGE_EVENT, callback);
      };
    },
    () => {
      const queryValue = new URLSearchParams(window.location.search).get(
        "presence",
      );
      const storedValue = window.localStorage.getItem(STORAGE_KEY);
      const candidate = queryValue ?? storedValue;
      return presenceVariants.includes(candidate as OrbitPresenceVariant)
        ? (candidate as OrbitPresenceVariant)
        : initial;
    },
    () => initial,
  );

  const setVariant = useCallback((next: OrbitPresenceVariant) => {
    window.localStorage.setItem(STORAGE_KEY, next);
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);

  return [variant, setVariant] as const;
}
