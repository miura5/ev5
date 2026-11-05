import type { Readiness } from "../types.ts";

/** Three bands, ready to weak, sized by their share; the numbers are in the row's meta, so it is decorative. */
export function ReadyBar({ ready, shaky, weak }: Readiness) {
  // No weak spots tied to the exam yet: one neutral band, "none yet", not an empty gap.
  if (ready + shaky + weak === 0)
    return (
      <span className="ev-today-bar" aria-hidden="true">
        <span
          className="ev-today-band ev-today-band-none"
          style={{ flexGrow: 1 }}
        />
      </span>
    );
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
