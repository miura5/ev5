import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { NotesScreen } from "./Notes.screen.tsx";
import type { NotesServices } from "./useNotes.ts";

afterEach(cleanup);

const services = (list: () => Promise<never>): NotesServices => ({
  docs: { list },
  outbox: {
    queueNote: vi.fn(),
    replay: vi.fn(async () => ({ refused: [] })),
  },
});

test("a server error shows the plain sentence, never the server's own words", async () => {
  render(
    <NotesScreen
      services={services(async () => {
        throw new Error("Notes could not load (503). SELECT * FROM docs");
      })}
    />,
  );
  await waitFor(() =>
    expect(screen.getByRole("status").textContent).toBe(
      "Something went wrong on E.V.\'s side. Try again in a moment.",
    ),
  );
  expect(document.body.textContent).not.toContain("SELECT");
});

test("no connection says so in plain words", async () => {
  render(
    <NotesScreen
      services={services(async () => {
        throw new TypeError("Failed to fetch");
      })}
    />,
  );
  await waitFor(() =>
    expect(screen.getByRole("status").textContent).toBe(
      "No connection right now. Try again when you are back online.",
    ),
  );
});

test("a refused token (401) is told in plain words", async () => {
  render(
    <NotesScreen
      services={services(async () => {
        throw Object.assign(new Error("x"), { status: 401 });
      })}
    />,
  );
  await waitFor(() =>
    expect(screen.getByRole("status").textContent).toBe(
      "E.V. did not accept this token. Paste the app token again.",
    ),
  );
});
