export interface ToastProps {
  message: string;
  /** Shown as a quiet Undo button when the action can be taken back. */
  onUndo?: () => void;
}

/** One quiet line at the bottom centre. */
export function Toast({ message, onUndo }: ToastProps) {
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
