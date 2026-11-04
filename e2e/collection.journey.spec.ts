import { expect, test } from "./gate5.ts";
import { cmd } from "./helpers.ts";

test("Collection: make, move a note in, pin, delete, restore", async ({
  api,
}) => {
  const tag = `e2e ${Date.now()}`;
  const a = (await cmd(api, "collection.create", { title: `${tag} A` }))[
    "collection"
  ] as { id: string };
  const b = (await cmd(api, "collection.create", { title: `${tag} B` }))[
    "collection"
  ] as { id: string };
  const note = (await cmd(api, "note.create", { collection: a.id }))[
    "id"
  ] as string;
  await cmd(api, "item.move", { id: note, collection: b.id });
  const mem = await api("GET", `/api/v1/memberships?collection_id=${b.id}`);
  expect(JSON.stringify(mem.body)).toContain(note);

  await cmd(api, "item.pin", { id: note });
  await cmd(api, "item.unpin", { id: note });

  await cmd(api, "item.delete", { id: note });
  const gone = await api("GET", "/api/v1/deletions?collection=notes");
  expect(JSON.stringify(gone.body)).toContain(note);
  await cmd(api, "item.restore", { id: note });
  const back = await api("GET", "/api/v1/deletions?collection=notes");
  expect(JSON.stringify(back.body)).not.toContain(note);
});
