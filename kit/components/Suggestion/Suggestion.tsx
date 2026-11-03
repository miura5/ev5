import { Button } from "../Button/Button";

export interface SuggestionProps {
  /** What E.V. proposes, in one line. */
  text: string;
  /** "proposal" would change the plan; "draft" is a made item waiting to be kept. */
  kind?: "proposal" | "draft";
  onAccept: () => void;
  onEdit?: () => void;
  onDismiss: () => void;
}

/** E.V.'s dashed suggestion, shown in the list it would change. */
export function Suggestion({ text, kind = "proposal", onAccept, onEdit, onDismiss }: SuggestionProps) {
  const keep = kind === "draft" ? "Keep" : "Accept";
  return (
    <div className="kit-suggest" data-ui="suggestion" data-kind={kind}>
      <span className="kit-suggest-plus" aria-hidden="true">
        +
      </span>
      <span className="kit-suggest-text">{text}</span>
      <Button kind="text" hint="A" onClick={onAccept}>
        {keep}
      </Button>
      {onEdit ? (
        <Button kind="text" hint="E" onClick={onEdit}>
          Edit
        </Button>
      ) : null}
      <Button kind="icon" aria-label={kind === "draft" ? "Drop" : "Not now"} onClick={onDismiss}>
        ×
      </Button>
    </div>
  );
}
