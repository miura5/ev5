import { Toast } from "../kit/index.ts";
import type { ToastItem } from "./useToasts.ts";

/** The one toast stack, bottom centre; hidden while ⌘K is open so a toast never shows over the palette (§ui.kit-leads). */
export function ToastHost({
  toasts,
  onDrop,
  hidden,
}: {
  toasts: readonly ToastItem[];
  onDrop: (id: number) => void;
  hidden?: boolean;
}) {
  if (hidden || toasts.length === 0) return null;
  return (
    <div className="shell-toasts" data-ui="toast-host">
      {toasts.map((t) => (
        <Toast
          key={t.id}
          message={t.message}
          onUndo={
            t.onUndo
              ? () => {
                  t.onUndo?.();
                  onDrop(t.id);
                }
              : undefined
          }
          onDone={() => onDrop(t.id)}
        />
      ))}
    </div>
  );
}
