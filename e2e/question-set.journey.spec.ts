import { expect, test } from "./gate5.ts";
import { cmd, tolerate } from "./helpers.ts";

// Hand-made set editing through the commands. Keep/drop of E.V.'s drafts needs a job-written set: NOT covered here.
test("Question set by hand, then keep and drop E.V.'s drafts", async ({
  api,
}) => {
  const set = (
    (await cmd(api, "set.create", { title: `e2e set ${Date.now()}` }))[
      "set"
    ] as { id: string }
  ).id;
  const added = (
    await cmd(api, "set.item_add", {
      set,
      text: "Which is a vital sign?\n- Hair colour\n* Pulse\n- Shoe size",
    })
  )["item"] as { itemId: string; v: number };
  const item = added.itemId;
  await cmd(api, "set.item_update", {
    set,
    item,
    text: "Which is a vital sign?\n- Hair colour\n* Pulse\n* Temperature",
    if_version: added.v,
  });
  const bad = await api("POST", "/api/v1/commands/set.item_add", {
    input: { set, text: "No options at all" },
  });
  expect(bad.status).toBe(400);
  try {
    await cmd(api, "set.item_delete", { set, item });
    await cmd(api, "set.done", { id: set });
  } finally {
    // Restore clears the Recently deleted row this run wrote (no repeated "Which is a vital sign?" rows); a set has no
    // delete command (§delete.who), so the set itself stays.
    await tolerate(() => cmd(api, "item.restore", { id: `${set}/${item}` }));
  }
});
