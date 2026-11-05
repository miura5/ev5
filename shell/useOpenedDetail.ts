import { useCallback, useEffect, useState } from "react";
import type { DetailProps } from "../kit/index.ts";

/** The Detail a view opened through onDetail: one panel, replaced by the next open, cleared by Esc, its close or leaving the screen. */
export function useOpenedDetail(screen: string, paletteOpen: boolean) {
  const [opened, setOpened] = useState<DetailProps | null>(null);
  const clear = useCallback(() => setOpened(null), []);
  useEffect(() => setOpened(null), [screen]);
  useEffect(() => {
    if (!opened || paletteOpen) return;
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpened(null);
    };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [opened, paletteOpen]);
  return [opened, setOpened, clear] as const;
}
