import { useCallback, useState } from "react";

export interface ToastItem {
  id: number;
  message: string;
  onUndo?: () => void;
}

/** What a view calls to show one toast; pass `onUndo` when the action can be taken back. */
export type OnToast = (message: string, onUndo?: () => void) => void;

let next = 0;

/** The shell's one toast list: views feed it through `show`, each toast drops itself through `drop` when it closes. */
export function useToasts() {
  const [toasts, setToasts] = useState<readonly ToastItem[]>([]);
  const show = useCallback<OnToast>((message, onUndo) => {
    setToasts((list) => [
      ...list.filter((t) => t.message !== message),
      { id: ++next, message, onUndo },
    ]);
  }, []);
  const drop = useCallback(
    (id: number) => setToasts((list) => list.filter((t) => t.id !== id)),
    [],
  );
  return { toasts, show, drop } as const;
}
