import type { Readiness } from "../types.ts";

/** Three bands, ready to weak, sized by their share; the numbers are in the row's meta, so it is decorative. */
export function ReadyBar({ ready, shaky, weak }: Readiness) {
  return (
    <span className="ev-today-bar" aria-hidden="true">
      <span
        className="ev-today-band ev-today-band-ok"
        style={{ flexGrow: ready }}
      />
      <span
        className="ev-today-band ev-today-band-warn"
        style={{ flexGrow: shaky }}
      />
      <span
        className="ev-today-band ev-today-band-bad"
        style={{ flexGrow: weak }}
      />
    </span>
  );
}
