import { createElement } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { NoteBlocks } from "./NoteBlocks";
import { Story } from "./NoteBlocks.story";

afterEach(cleanup);

const t = (text: string) => [{ text }];

test("a leading heading that repeats the title is left out", () => {
  render(
    createElement(NoteBlocks, {
      title: "Heart",
      blocks: [
        { type: "h1", runs: t("Heart") },
        { type: "p", runs: t("Intro") },
      ],
    }),
  );
  expect(screen.queryByText("Heart")).toBeNull();
  expect(screen.getByText("Intro")).toBeTruthy();
});

test("to-dos are read-only without onToggle and toggle by index with it", () => {
  const blocks = [
    { type: "p", runs: t("a") },
    { type: "todo", runs: t("b") },
  ];
  const { rerender } = render(createElement(NoteBlocks, { blocks }));
  expect((screen.getByRole("checkbox") as HTMLInputElement).readOnly).toBe(
    true,
  );
  const onToggle = vi.fn();
  rerender(createElement(NoteBlocks, { blocks, onToggle }));
  fireEvent.click(screen.getByRole("checkbox"));
  expect(onToggle).toHaveBeenCalledWith(1);
});

test("blocks sharing a row id draw in two columns; an unknown type is a paragraph", () => {
  const { container } = render(
    createElement(NoteBlocks, {
      blocks: [
        { type: "img", runs: [], alt: "Curve", row: "r", col: 0 },
        { type: "weird", runs: t("Beside"), row: "r", col: 1 },
      ],
    }),
  );
  expect(container.querySelectorAll(".kit-note-col")).toHaveLength(2);
  expect(screen.getByText("Image · Curve")).toBeTruthy();
  expect(screen.getByText("Beside").closest("p")).toBeTruthy();
});

test("the story renders", () => {
  render(createElement(Story));
  expect(screen.getAllByText("Say the idea")).toHaveLength(2);
});
