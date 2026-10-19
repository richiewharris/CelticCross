import { useEffect, useState } from "react";

/** useState that survives reloads via localStorage (silently in-memory when storage is blocked). */
export function useStoredState<T>(key: string, initial: T | (() => T)) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw != null) return JSON.parse(raw) as T;
    } catch { /* storage unavailable */ }
    return typeof initial === "function" ? (initial as () => T)() : initial;
  });
  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable */ }
  }, [key, value]);
  return [value, setValue] as const;
}
