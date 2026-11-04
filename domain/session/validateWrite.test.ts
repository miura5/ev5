import { expect, test } from "vitest";
import { validateWrite } from "../../data/compat-test.ts";
import { startSession, switchSession } from "./lifecycle.ts";
import type { SessionDoc } from "./index.ts";

// ev4's sessions schema allows source "Study Watch" | "E.V. Home" only, so v5 keeps "E.V. Home" and
// validateWrite waives the v5-source rule for sessions.
test("a session start and a switch are writes ev4 accepts", () => {
  const w = startSession({
    id: "s-20261104-100000",
    key: "page-20261104-100000",
    at: "2026-11-04T10:00:00Z",
    noteId: "n-20261104-100000-abcdef123456",
    topic: "Cardiac output",
  } as never);
  expect(validateWrite("sessions", w.data)).toEqual({ ok: true });
  expect((w.data as { source?: string }).source).toBe("E.V. Home");
  const s = { ...w.data, id: w.id, status: "active" } as unknown as SessionDoc;
  for (const u of switchSession(s, {
    at: "2026-11-04T10:30:00Z",
    key: "page-20261104-103000",
  })) {
    const d = u.data as { events: object };
    const next = {
      ...w.data,
      ...u.data,
      events: { ...(w.data as { events: object }).events, ...d.events },
    };
    expect(validateWrite("sessions", next, { prev: w.data })).toEqual({
      ok: true,
    });
  }
});
