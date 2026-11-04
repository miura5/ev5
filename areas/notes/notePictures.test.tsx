import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { NoteEditor } from "./parts/NoteEditor.tsx";
import { NO_STORAGE } from "./parts/notePictures.ts";

const IMG_KEY = /^note-images\/[A-Za-z0-9]{16,64}\.(png|jpg|webp|gif)$/;
const png = () =>
  new File([new Uint8Array([137, 80, 78, 71])], "a.png", { type: "image/png" });
const pasteFile = (f: File) => {
  const ed = document.querySelector(".ProseMirror")!;
  const ev = new Event("paste", {
    bubbles: true,
    cancelable: true,
  }) as Event & { clipboardData: unknown };
  ev.clipboardData = { files: [f], getData: () => "" };
  ed.dispatchEvent(ev);
};

beforeEach(() => {
  URL.createObjectURL = vi.fn(() => "blob:pic");
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

test("a pasted picture uploads, is saved as an img block, and is shown from a fetched blob", async () => {
  const calls: { url: string; method: string; auth: string }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      calls.push({
        url,
        method: init.method ?? "GET",
        auth: (init.headers as Record<string, string>).authorization!,
      });
      return init.method === "PUT"
        ? new Response("{}")
        : new Response("x", { headers: { "content-type": "image/png" } });
    }),
  );
  const out: unknown[][] = [];
  render(
    <NoteEditor
      blocks={[{ type: "p", runs: [{ text: "hello" }] }]}
      onChange={(b) => out.push(b)}
    />,
  );
  pasteFile(png());
  await waitFor(() =>
    expect(document.querySelector("figure img")).toBeTruthy(),
  );
  expect(document.querySelector("figure img")!.getAttribute("src")).toBe(
    "blob:pic",
  );
  const [put, get] = calls;
  expect(put!.method).toBe("PUT");
  expect(put!.url.replace("/api/v1/", "")).toMatch(IMG_KEY);
  expect(get!.method).toBe("GET");
  expect(get!.url).toBe(put!.url);
  expect(put!.auth).toMatch(/^Bearer /);
  await waitFor(() => expect(out.length).toBe(1), { timeout: 2000 });
  const blocks = out[0] as {
    type: string;
    key?: string;
    runs: { text: string }[];
  }[];
  expect(blocks[0]!.runs[0]!.text).toBe("hello");
  expect(blocks.some((b) => b.type === "img" && IMG_KEY.test(b.key!))).toBe(
    true,
  );
});

test("when picture storage is not set up the note text stays and a plain message shows", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response('{"error":"x"}', { status: 503 })),
  );
  const out: unknown[] = [];
  render(
    <NoteEditor
      blocks={[{ type: "p", runs: [{ text: "keep me" }] }]}
      onChange={(b) => out.push(b)}
    />,
  );
  fireEvent.blur(document.querySelector(".ProseMirror")!);
  pasteFile(png());
  await screen.findByText(NO_STORAGE);
  expect(document.querySelector("figure")).toBeNull();
  expect(document.querySelector(".ProseMirror")!.textContent).toBe("keep me");
  expect(out.length).toBe(0);
});
