import { useCallback, useEffect, useState } from "react";
import type { Theme } from "../kit/index.ts";

const KEY = "ev5.theme";

/** The saved choice on this device, else the system's; both reads survive blocked storage. */
export function initialTheme(): Theme {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === "dark" || saved === "light") return saved;
  } catch {
    /* storage blocked: follow the system */
  }
  try {
    return window.matchMedia?.("(prefers-color-scheme: light)").matches
      ? "light"
      : "dark";
  } catch {
    return "dark";
  }
}

/** The app theme: set as `data-theme` on the page root (`<html>`), so portals rendered in body inherit it, kept on this device once Matt has chosen. */
export function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>(initialTheme);
  const toggle = useCallback(() => {
    setTheme((t) => {
      const next: Theme = t === "dark" ? "light" : "dark";
      try {
        localStorage.setItem(KEY, next);
      } catch {
        /* the choice still applies this session */
      }
      return next;
    });
  }, []);
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-theme", theme);
    root.style.colorScheme = theme;
    return () => root.removeAttribute("data-theme");
  }, [theme]);
  return [theme, toggle];
}
