import { Button } from "../../components/Button/Button";

export interface EmptyProps {
  /** One quiet line. */
  line: string;
  action?: string;
  onAction?: () => void;
}

/** Nothing here yet: one quiet line and the one thing to do about it. */
export function Empty({ line, action, onAction }: EmptyProps) {
  return (
    <div className="kit-empty" data-ui="empty">
      <span>{line}</span>
      {action && onAction ? (
        <Button kind="secondary" onClick={onAction}>
          {action}
        </Button>
      ) : null}
    </div>
  );
}
