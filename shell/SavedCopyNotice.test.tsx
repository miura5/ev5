import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { SavedCopyNotice } from "./SavedCopyNotice.tsx";
import { createReadCopy } from "./readCopy.ts";
import { memoryCopyStore } from "./readCopy.testkit.ts";

afterEach(cleanup);

test("the notice shows while the screen data is the saved copy, and goes when a read works", async () => {
  const c = createReadCopy(memoryCopyStore());
  render(<SavedCopyNotice copy={c} />);
  expect(screen.queryByRole("status")).toBeNull();
  await act(() => c.read("k", async () => 1));
  await act(() =>
    c.read("k", async () => {
      throw new TypeError("offline");
    }),
  );
  expect(screen.getByRole("status").textContent).toContain("Saved copy");
  await act(() => c.read("k", async () => 2));
  expect(screen.queryByRole("status")).toBeNull();
});
