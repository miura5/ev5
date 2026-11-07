import { cleanup, render } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { useReloadHold } from "./useStudy.ts";

afterEach(cleanup);

// Same contract as shell/pwa.ts createReloadHold (areas never import the shell).
function createReloadHold(reload: () => void) {
  let open = 0;
  let pending = false;
  const settle = () => {
    if (open === 0 && pending) {
      pending = false;
      reload();
    }
  };
  return {
    hold: () => {
      open += 1;
      return () => {
        open -= 1;
        settle();
      };
    },
    requestReload: () => {
      pending = true;
      settle();
    },
  };
}

function Host({ active, hold }: { active: boolean; hold: () => () => void }) {
  useReloadHold(active, { outbox: { replay: vi.fn() }, holdReload: hold });
  return null;
}

test("a new build waits while a study run is open and reloads when it ends", () => {
  const reload = vi.fn();
  const gate = createReloadHold(reload);
  const hold = () => gate.hold();
  const { rerender } = render(<Host active hold={hold} />);
  gate.requestReload();
  expect(reload).not.toHaveBeenCalled();
  rerender(<Host active={false} hold={hold} />);
  expect(reload).toHaveBeenCalledTimes(1);
});

test("leaving the screen releases the hold", () => {
  const reload = vi.fn();
  const gate = createReloadHold(reload);
  const { unmount } = render(<Host active hold={() => gate.hold()} />);
  gate.requestReload();
  unmount();
  expect(reload).toHaveBeenCalledTimes(1);
});
