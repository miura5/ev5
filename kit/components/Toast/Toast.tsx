import { useEffect, useRef, useState } from "react";

/** How long a toast stays, as design/mockup.html toast(). */
export const TOAST_MS = 4000;

export interface ToastProps {
  message: string;
  /** Shown as a quiet Undo button when the action can be taken back. */
  onUndo?: () => void;
  /** Called when the toast hides itself, so the owner can drop its message. */
  onDone?: () => void;
}

/** One quiet line at the bottom centre. It hides itself after about 4 seconds. */
export function Toast({ message, onUndo, onDone }: ToastProps) {
  const [shownFor, setShownFor] = useState<string>();
  const done = useRef(onDone);
  done.current = onDone;
  const hidden = shownFor === `done:${message}`;
  useEffect(() => {
    setShownFor(message);
    const t = setTimeout(() => {
      setShownFor(`done:${message}`);
      done.current?.();
    }, TOAST_MS);
    return () => clearTimeout(t);
  }, [message]);
  if (hidden) return null;
  return (
    <div role="status" className="kit-toast" data-ui="toast">
      <span>{message}</span>
      {onUndo ? (
        <button type="button" className="kit-toast-undo" onClick={onUndo}>
          Undo
        </button>
      ) : null}
    </div>
  );
}
