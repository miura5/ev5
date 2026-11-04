import { useSyncExternalStore } from "react";
import type { ReadCopy } from "./readCopy.ts";

/** Shown while a screen's data comes from the copy kept on this device; uses the shell's existing notice look. */
export function SavedCopyNotice({ copy }: { copy: ReadCopy | undefined }) {
  const on = useSyncExternalStore(
    (f) => copy?.subscribe(f) ?? (() => undefined),
    () => copy?.usingCopy() ?? false,
  );
  if (!on) return null;
  return (
    <div className="shell-offer" role="status" data-ui="saved-copy">
      <span>
        Saved copy: you're offline, so this is what was here the last time you
        were connected.
      </span>
    </div>
  );
}
