import type { Mastery } from "../types.ts";

/** Three segments (right, shaky, wrong) sized by share; decorative, the row's meta carries the words. */
export function MasteryBar({ mastery }: { mastery: Mastery }) {
  return (
    <span className="ev-library-bar" aria-hidden="true">
      <span style={{ flexGrow: mastery.right }} data-seg="right" />
      <span style={{ flexGrow: mastery.shaky }} data-seg="shaky" />
      <span style={{ flexGrow: mastery.wrong }} data-seg="wrong" />
    </span>
  );
}
