import { expect, test } from "./gate5.ts";
import { cmd, softDelete, tolerate } from "./helpers.ts";

test("Collection: make, move a note in, pin, delete, restore", async ({
  api,
}) => {
  const made = async (title: string) =>
    (
      (await cmd(api, "collection.create", { title }))["collection"] as {
        id: string;
      }
    ).id;
  const a = { id: await made("e2e journey A") };
  const b = { id: await made("e2e journey B") };
  const note = (await cmd(api, "note.create", { collection: a.id }))[
    "id"
  ] as string;
  try {
    const read = await api("GET", `/api/v1/notes/${note}`);
    expect(read.status).toBe(200);
    await cmd(api, "item.move", {
      id: note,
      collection: b.id,
      if_version: read.body["v"] as number,
    });
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

    // Deleting the collection sets `deleted_at` on its row; the note shows ungrouped, and Restore regroups it.
    await cmd(api, "item.delete", { id: b.id });
    const del = await api("GET", "/api/v1/deletions");
    const rows = (del.body["deletions"] ?? []) as {
      collection: string;
      id: string;
    }[];
    expect(rows.filter((r) => r.id === b.id).map((r) => r.collection)).toEqual([
      "collections",
    ]);
    expect(rows.some((r) => r.id === note)).toBe(false);
    const listed = await api("GET", "/api/v1/collections");
    expect(JSON.stringify(listed.body)).not.toContain(b.id);
    const ungrouped = await api(
      "GET",
      `/api/v1/memberships?collection_id=${b.id}`,
    );
    expect(JSON.stringify(ungrouped.body)).not.toContain(note);

    await cmd(api, "item.restore", { id: b.id });
    const regrouped = await api(
      "GET",
      `/api/v1/memberships?collection_id=${b.id}`,
    );
    expect(JSON.stringify(regrouped.body)).toContain(note);
  } finally {
    await tolerate(() => cmd(api, "item.restore", { id: b.id }));
    await softDelete(api, note);
    await softDelete(api, a.id);
    await softDelete(api, b.id);
  }
});
