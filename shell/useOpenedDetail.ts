import { useCallback, useEffect, useState } from "react";
import type { DetailProps } from "../kit/index.ts";

/** The Detail a view opened through onDetail: one panel, replaced by the next open, cleared by Esc (which also clears ?open= from the address), its close or leaving the screen. */
export function useOpenedDetail(
  path: string,
  paletteOpen: boolean,
  /** Esc sends the address here, without ?open=, when it holds one (not on Notes, whose Detail is only its shortcuts). */
  onNavigate?: (to: string) => void,
) {
  const [screen = path, query = ""] = path.split("?");
  const [opened, setOpened] = useState<DetailProps | null>(null);
  const hasOpen = new URLSearchParams(query).has("open");
  const clear = useCallback(() => setOpened(null), []);
  useEffect(() => setOpened(null), [screen]);
  useEffect(() => {
    if (!opened || paletteOpen) return;
    const onEsc = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpened(null);
      if (hasOpen && screen !== "/notes") onNavigate?.(screen);
    };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [opened, paletteOpen, hasOpen, screen, onNavigate]);
  return [opened, setOpened, clear] as const;
}
