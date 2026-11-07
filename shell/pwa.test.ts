import { expect, test, vi } from "vitest";
import { createReloadHold, startPwa, type RegisterSW } from "./pwa.ts";

function setup() {
  let opts: Parameters<RegisterSW>[0];
  const register: RegisterSW = (o) => void (opts = o);
  const listeners: Record<string, () => void> = {};
  const win = { addEventListener: (n: string, f: () => void) => void (listeners[n] = f) };
  const reload = vi.fn();
  const gate = createReloadHold(reload);
  startPwa(register, win as never, gate);
  return { opts: () => opts!, listeners, reload, gate };
}

test("registers at once and reloads when a new worker takes over", () => {
  const s = setup();
  expect(s.opts().immediate).toBe(true);
  s.opts().onNeedReload!();
  expect(s.reload).toHaveBeenCalledTimes(1);
});

test("holds the reload while an attempt is open, then reloads once when it closes", () => {
  const s = setup();
  const a = s.gate.hold();
  const b = s.gate.hold();
  s.opts().onNeedReload!();
  expect(s.reload).not.toHaveBeenCalled();
  a();
  a();
  expect(s.reload).not.toHaveBeenCalled();
  b();
  expect(s.reload).toHaveBeenCalledTimes(1);
});

test("a closed attempt with no new build reloads nothing", () => {
  const s = setup();
  s.gate.hold()();
  expect(s.reload).not.toHaveBeenCalled();
});

test("checks for a new build when the window regains focus", () => {
  const s = setup();
  const update = vi.fn().mockResolvedValue(undefined);
  s.listeners.focus!();
  s.opts().onRegisteredSW!("/sw.js", { update } as never);
  s.listeners.focus!();
  expect(update).toHaveBeenCalledTimes(1);
});

test("does nothing without a window", () => {
  const register = vi.fn();
  expect(() => startPwa(register, undefined, { requestReload: vi.fn() })).not.toThrow();
});
