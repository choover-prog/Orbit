"use client";

import { useCallback, useEffect, useState } from "react";
import type { OrbitPresenceVariant } from "../OrbitPresence.types";
import { presenceVariants } from "../OrbitPresence.types";

const STORAGE_KEY = "orbit.presence.variant";
const CHANGE_EVENT = "orbit-presence-change";

function readVariantPreference(initial: OrbitPresenceVariant) {
  const queryValue = new URLSearchParams(window.location.search).get(
    "presence",
  );
  const storedValue = window.localStorage.getItem(STORAGE_KEY);
  const candidate = queryValue ?? storedValue;
  return presenceVariants.includes(candidate as OrbitPresenceVariant)
    ? (candidate as OrbitPresenceVariant)
    : initial;
}

export function usePresencePreference(
  initial: OrbitPresenceVariant = "hybrid",
) {
  const [variant, setVariantState] = useState<OrbitPresenceVariant>(initial);

  useEffect(() => {
    const syncPreference = () =>
      setVariantState(readVariantPreference(initial));
    syncPreference();
    window.addEventListener("storage", syncPreference);
    window.addEventListener("popstate", syncPreference);
    window.addEventListener(CHANGE_EVENT, syncPreference);
    return () => {
      window.removeEventListener("storage", syncPreference);
      window.removeEventListener("popstate", syncPreference);
      window.removeEventListener(CHANGE_EVENT, syncPreference);
    };
  }, [initial]);

  const setVariant = useCallback((next: OrbitPresenceVariant) => {
    window.localStorage.setItem(STORAGE_KEY, next);
    setVariantState(next);
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);

  return [variant, setVariant] as const;
}
