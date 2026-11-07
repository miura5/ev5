import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, vi } from "vitest";
import {
  createReloadHold,
  startPwa,
  UPDATE_CHECK_MS,
  type RegisterSW,
} from "./pwa.ts";

function setup() {
  let opts: Parameters<RegisterSW>[0];
  const register: RegisterSW = (o) => void (opts = o);
  const listeners: Record<string, () => void> = {};
  const timers: [() => void, number][] = [];
  const win = {
    addEventListener: (n: string, f: () => void) => void (listeners[n] = f),
    setInterval: (f: () => void, ms: number) => (timers.push([f, ms]), 1),
  };
  const reload = vi.fn();
  const gate = createReloadHold(reload);
  startPwa(register, win as never, gate);
  return { opts: () => opts!, listeners, timers, reload, gate };
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

test("checks for a new build on a timer, so a background tab also updates", () => {
  const s = setup();
  const update = vi.fn().mockResolvedValue(undefined);
  s.opts().onRegisteredSW!("/sw.js", { update } as never);
  expect(s.timers.length).toBe(1);
  expect(s.timers[0]![1]).toBe(UPDATE_CHECK_MS);
  s.timers[0]![0]();
  expect(update).toHaveBeenCalledTimes(1);
});

test("does nothing without a window", () => {
  const register = vi.fn();
  expect(() =>
    startPwa(register, undefined, { requestReload: vi.fn() }),
  ).not.toThrow();
});

test("the generated worker takes over at once, so a reload runs the new build", () => {
  // registerSW in autoUpdate mode sends no skip-waiting message: the worker itself must skip waiting and claim pages.
  const config = readFileSync(
    join(import.meta.dirname, "..", "vite.config.ts"),
    "utf8",
  );
  expect(config).toMatch(/injectRegister:\s*false/);
  expect(config).toMatch(/skipWaiting:\s*true/);
  expect(config).toMatch(/clientsClaim:\s*true/);
});
