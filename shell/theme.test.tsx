import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { Shell } from "./Shell.tsx";
import { Menu } from "../kit/index.ts";

afterEach(cleanup);

test("the Menu and the ⌘K palette portals sit under the page root's theme, not the system's", () => {
  localStorage.setItem("ev5.theme", "light");
  const original = window.matchMedia;
  // The system says dark; Matt chose light.
  window.matchMedia = ((q: string) => ({
    matches: q.includes("dark"),
    media: q,
    addEventListener() {},
    removeEventListener() {},
  })) as unknown as typeof window.matchMedia;
  try {
    const withMenu = [
      {
        id: "today",
        route: "/",
        nav: "Today",
        view: () => (
          <Menu
            label="More"
            onPick={vi.fn()}
            items={[{ key: "r", label: "Rename" }]}
            trigger={<button type="button">More</button>}
          />
        ),
      },
    ];
    render(<Shell path="/" onNavigate={vi.fn()} areas={withMenu} />);
    const theme = (el: Element | null) =>
      el?.closest("[data-theme]")?.getAttribute("data-theme");
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    expect(
      document.querySelector("[data-ui='shell']")?.hasAttribute("data-theme"),
    ).toBe(false);
    fireEvent.keyDown(window, { key: "k", metaKey: true });
    const palette = screen.getByRole("dialog");
    expect(document.querySelector("[data-ui='shell']")?.contains(palette)).toBe(
      false,
    );
    expect(theme(palette)).toBe("light");
    fireEvent.keyDown(document.activeElement ?? window, { key: "Escape" });
    fireEvent.pointerDown(screen.getByRole("button", { name: "More" }), {
      button: 0,
      pointerType: "mouse",
    });
    const menu = screen.getByRole("menu");
    expect(theme(menu)).toBe("light");
  } finally {
    window.matchMedia = original;
    localStorage.clear();
  }
});
