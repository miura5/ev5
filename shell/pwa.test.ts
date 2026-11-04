import { expect, test, vi } from "vitest";
import { registerPwa } from "./pwa.ts";

test("registers /sw.js when service workers exist", () => {
  const register = vi.fn().mockResolvedValue({});
  expect(registerPwa({ serviceWorker: { register } } as never)).toBe(true);
  expect(register).toHaveBeenCalledWith("/sw.js", { scope: "/" });
});

test("does nothing without service worker support", () => {
  expect(registerPwa({} as never)).toBe(false);
});
