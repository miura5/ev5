import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { notesArea } from "../areas/notes/area.ts";
import { createOutbox, docsHttp, memoryStore } from "./outbox/index.ts";
import type { Services } from "./services.ts";

const NotesScreen = notesArea.view;

afterEach(cleanup);

const note = (title: string) => ({
  schema: 1,
  writer: "page",
  at: "2026-10-26T15:00:00.000Z",
  source: "E.V. Home",
  createdAt: "2026-10-26T15:00:00.000Z",
  title,
  course: "NUR 112",
  blocks: [
    { type: "h1", runs: [{ text: title }] },
    { type: "p", runs: [{ text: "Sodium range" }] },
  ],
});

/** A fake server: one note, the write protocol's version pin, and a switch for the connection. */
function fakeServer() {
  const s = {
    v: 1,
    data: note("Fluids") as Record<string, unknown>,
    online: true,
    puts: [] as string[],
  };
  const fetch = async (url: string, init?: RequestInit) => {
    if (!s.online) throw new TypeError("offline");
    const u = new URL(url, "http://x");
    if (init?.method === "PUT") {
      s.puts.push(u.search);
      if (Number(u.searchParams.get("if_version")) !== s.v)
        return new Response("{}", { status: 409 });
      s.data = JSON.parse(String(init.body));
      return Response.json({ at: 2, version: ++s.v });
    }
    return Response.json({
      docs: [{ id: "n-1", v: s.v, at: 1, data: s.data }],
    });
  };
  const http = docsHttp(() => "tok", fetch);
  const outbox = createOutbox({
    store: memoryStore(),
    transport: http.transport,
  });
  const services: Services = { docs: http, outbox };
  return { s, services };
}

async function openAndRename(services: Services, title: string) {
  render(<NotesScreen services={services} />);
  fireEvent.click((await screen.findAllByText("Fluids"))[0]!);
  fireEvent.change(screen.getByLabelText("Title"), {
    target: { value: title },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
}

test("notes load from the docs routes and a title edit saves, pinned to the version read", async () => {
  const { s, services } = fakeServer();
  await openAndRename(services, "Fluids and electrolytes");
  await waitFor(() => expect(s.v).toBe(2));
  expect(s.puts).toEqual(["?collection=notes&id=n-1&if_version=1"]);
  expect((s.data as { title: string }).title).toBe("Fluids and electrolytes");
  await waitFor(() => expect(screen.getByText("saved")).toBeTruthy());
  expect(
    screen.getAllByRole("heading", { name: "Fluids and electrolytes" })[0],
  ).toBeTruthy();
});

test("offline, the edit shows not saved and waits in the outbox; it sends when the connection returns", async () => {
  const { s, services } = fakeServer();
  render(<NotesScreen services={services} />);
  fireEvent.click((await screen.findAllByText("Fluids"))[0]!);
  s.online = false;
  fireEvent.change(screen.getByLabelText("Title"), {
    target: { value: "Fluids, offline" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  await waitFor(() => expect(screen.getByText("not saved")).toBeTruthy());
  expect(
    screen.getAllByRole("heading", { name: "Fluids, offline" })[0],
  ).toBeTruthy();
  expect(await services.outbox.count()).toBe(1);
  expect(s.v).toBe(1);
  s.online = true;
  const res = await services.outbox.replay();
  expect(res.sent).toBe(1);
  expect(s.v).toBe(2);
  expect((s.data as { title: string }).title).toBe("Fluids, offline");
});

test("a refused token shows a plain sentence and no notes", async () => {
  const http = docsHttp(
    () => "",
    async () => new Response("{}", { status: 401 }),
  );
  const outbox = createOutbox({
    store: memoryStore(),
    transport: http.transport,
  });
  render(<NotesScreen services={{ docs: http, outbox }} />);
  expect(await screen.findByText(/E\.V\. did not accept this token/)).toBeTruthy();
});

test("a block edit saves through the outbox, and New note queues a create", async () => {
  const { s, services } = fakeServer();
  render(<NotesScreen services={services} />);
  fireEvent.click((await screen.findAllByText("Fluids"))[0]!);
  const editor = await waitFor(() => {
    const el = document.querySelector(".ProseMirror");
    if (!el) throw new Error("no editor");
    return el;
  });
  const para = editor.querySelectorAll("[data-block]")[1]!;
  const textNode = document.createTreeWalker(para, NodeFilter.SHOW_TEXT).nextNode()!;
  textNode.nodeValue = "Sodium 135-145";
  fireEvent.blur(editor);
  await waitFor(() => expect(s.v).toBe(2));
  const saved = s.data as { blocks: { runs: { text: string }[] }[] };
  expect(saved.blocks[1]!.runs[0]!.text).toBe("Sodium 135-145");
  fireEvent.click(screen.getByRole("button", { name: /Notes/ }));
  fireEvent.click(screen.getByRole("button", { name: /New note/ }));
  await waitFor(() => expect(s.puts.length).toBe(2));
  expect(s.puts[1]).toMatch(
    /^\?collection=notes&id=n-\d{8}-\d{6}-[A-Za-z0-9]+$/,
  );
});
