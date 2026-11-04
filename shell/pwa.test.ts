import { expect, test, vi } from "vitest";
import { registerPwa } from "./pwa.ts";

function fakeSw(controller: unknown) {
  const listeners: Record<string, () => void> = {};
  const update = vi.fn().mockResolvedValue(undefined);
  const register = vi.fn().mockResolvedValue({ update });
  const serviceWorker = {
    controller,
    register,
    addEventListener: (n: string, f: () => void) => (listeners[n] = f),
  };
  return { serviceWorker, register, listeners, update };
}
function fakeDoc() {
  const listeners: Record<string, () => void> = {};
  return {
    visibilityState: "visible",
    addEventListener: (n: string, f: () => void) => (listeners[n] = f),
    listeners,
  };
}

test("registers /sw.js when service workers exist", () => {
  const { serviceWorker, register } = fakeSw(null);
  expect(
    registerPwa(
      serviceWorker ? ({ serviceWorker } as never) : undefined,
      undefined,
      vi.fn(),
    ),
  ).toBe(true);
  expect(register).toHaveBeenCalledWith("/sw.js", { scope: "/" });
});

test("does nothing without service worker support", () => {
  expect(registerPwa({} as never)).toBe(false);
});

test("reloads once when a new worker takes over an open page", () => {
  const { serviceWorker, listeners } = fakeSw({});
  const reload = vi.fn();
  registerPwa({ serviceWorker } as never, undefined, reload);
  listeners.controllerchange!();
  listeners.controllerchange!();
  expect(reload).toHaveBeenCalledTimes(1);
});

test("does not reload on the very first install", () => {
  const { serviceWorker, listeners } = fakeSw(null);
  const reload = vi.fn();
  registerPwa({ serviceWorker } as never, undefined, reload);
  listeners.controllerchange!();
  expect(reload).not.toHaveBeenCalled();
});

test("checks for a new build when the app regains focus", async () => {
  const { serviceWorker, update } = fakeSw({});
  const doc = fakeDoc();
  registerPwa({ serviceWorker } as never, doc as never, vi.fn());
  await Promise.resolve();
  await Promise.resolve();
  doc.listeners.visibilitychange!();
  expect(update).toHaveBeenCalledTimes(1);
});

test("tells a waiting worker to skip waiting so the page reloads into the new build", async () => {
  const { serviceWorker, register } = fakeSw({});
  const postMessage = vi.fn();
  register.mockResolvedValue({ update: vi.fn(), waiting: { postMessage } });
  registerPwa({ serviceWorker } as never, undefined, vi.fn());
  await Promise.resolve();
  await Promise.resolve();
  expect(postMessage).toHaveBeenCalledWith({ type: "SKIP_WAITING" });
});

test("does not skip waiting on the first install", async () => {
  const { serviceWorker, register } = fakeSw(null);
  const postMessage = vi.fn();
  register.mockResolvedValue({ waiting: { postMessage } });
  registerPwa({ serviceWorker } as never, undefined, vi.fn());
  await Promise.resolve();
  await Promise.resolve();
  expect(postMessage).not.toHaveBeenCalled();
});

test("skips waiting when a new worker finishes installing", async () => {
  const { serviceWorker, register } = fakeSw({});
  const postMessage = vi.fn();
  const w: {
    state: string;
    postMessage: typeof postMessage;
    fire?: () => void;
    addEventListener: unknown;
  } = {
    state: "installing",
    postMessage,
    addEventListener: (_n: string, f: () => void) => (w.fire = f),
  };
  let found: () => void = () => undefined;
  register.mockResolvedValue({
    installing: w,
    waiting: null,
    addEventListener: (_n: string, f: () => void) => (found = f),
  });
  registerPwa({ serviceWorker } as never, undefined, vi.fn());
  await Promise.resolve();
  await Promise.resolve();
  found();
  w.state = "installed";
  w.fire!();
  expect(postMessage).toHaveBeenCalledWith({ type: "SKIP_WAITING" });
});
