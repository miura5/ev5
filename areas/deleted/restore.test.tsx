import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { DeletedScreen as RawDeletedScreen } from "./Deleted.screen.tsx";
import { withToasts } from "../testToasts.tsx";
import { restoreId } from "./useDeleted.ts";

const DeletedScreen = withToasts(RawDeletedScreen);

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  localStorage.clear();
});

test("restoreId drops the collection and keeps a nested id whole", () => {
  expect(restoreId("notes/n1")).toBe("n1");
  expect(restoreId("own_set_items/s1/i1")).toBe("s1/i1");
});

function setup(restoreStatus: number) {
  localStorage.setItem("ev5.token", "t");
  const calls: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      calls.push(`${url} ${init?.body ?? ""}`);
      if (String(url).includes("commands/item.restore"))
        return new Response(JSON.stringify({ mode: "direct", result: {} }), { status: restoreStatus });
      return new Response(
        JSON.stringify({ deletions: [{ collection: "notes", id: "n1", at: Date.now(), title: "Cardiac drugs" }] }),
        { status: 200 },
      );
    }),
  );
  return calls;
}

test("Restore calls item.restore and the item leaves the list", async () => {
  const calls = setup(200);
  render(<DeletedScreen />);
  fireEvent.click(await screen.findByLabelText("Restore Cardiac drugs"));
  await waitFor(() => expect(screen.getByText("Nothing here.")).toBeTruthy());
  expect(calls.some((c) => c.includes("commands/item.restore") && c.includes('"id":"n1"'))).toBe(true);
});

test("a failed restore keeps the item", async () => {
  setup(500);
  render(<DeletedScreen />);
  fireEvent.click(await screen.findByLabelText("Restore Cardiac drugs"));
  await waitFor(() => expect(screen.getByRole("status") ?? screen.getByText(/./)).toBeTruthy());
  expect(screen.getByLabelText("Restore Cardiac drugs")).toBeTruthy();
});
