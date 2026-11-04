import type { ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonKind = "primary" | "secondary" | "text" | "icon";

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className"> {
  kind?: ButtonKind;
  /** The key that does the same thing, shown quietly beside the label. */
  hint?: string;
  children?: ReactNode;
}

/** An icon button has no visible label, so it must say what it does. */
export function Button({ kind = "secondary", hint, type = "button", children, ...rest }: ButtonProps) {
  return (
    <button data-ui="button" {...rest} type={type} className={`kit-btn kit-btn-${kind}`} data-kind={kind}>
      {children}
      {hint ? <kbd className="kit-kbd">{hint}</kbd> : null}
    </button>
  );
}
