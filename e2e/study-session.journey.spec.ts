import { expect, test } from "./gate5.ts";
import { cmd } from "./helpers.ts";

test("Study session: run one", async ({ api }) => {
  const id = (await cmd(api, "session.start", {}))["id"] as string;
  expect(id).toMatch(/^ss-/);
  const doc = async () =>
    (await api("GET", `/api/v1/sessions/${id}`)).body as { status: string };
  expect((await doc()).status).toBe("active");

  expect((await cmd(api, "session.pause", { id }))["paused"]).toBe(true);
  expect((await cmd(api, "session.pause", { id }))["paused"]).toBe(false);
  await cmd(api, "check.just_tell_me", { id });
  expect(typeof (await cmd(api, "session.end", { id }))["minutes"]).toBe(
    "number",
  );
  expect((await doc()).status).toBe("ended");

  const again = await api("POST", "/api/v1/commands/session.end", {
    input: { id },
  });
  expect(again.status).toBe(409);
});
