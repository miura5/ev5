import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { askArea } from "./area.ts";
import { AskView } from "./Ask.view.tsx";
import type { AskMessage } from "./types.ts";

afterEach(cleanup);

const messages: AskMessage[] = [
  { id: "1", from: "you", at: "9:12 am", text: "preload vs afterload?" },
  { id: "2", from: "ev", text: "Give it a try first.", asksTry: true },
  { id: "3", from: "ev", text: "Yes, both right.", source: "Cardiac output", breakBefore: true },
  { id: "4", from: "ev", text: "Still writing.", job: { title: "Mock exam", meta: "9 of 15", running: true } },
];

test("the chat shows turns, a source, a job row and the try-first button", () => {
  const onJustTell = vi.fn();
  render(<AskView messages={messages} onSend={() => {}} onJustTell={onJustTell} />);
  expect(screen.getByText("9:12 am")).toBeTruthy();
  expect(screen.getByText("from Note · Cardiac output")).toBeTruthy();
  expect(screen.getByText("Mock exam")).toBeTruthy();
  expect(screen.getAllByRole("separator")).toHaveLength(1);
  fireEvent.click(screen.getByText("Just tell me"));
  expect(onJustTell).toHaveBeenCalledWith("2");
  expect(askArea.route).toBe("/ask");
});

test("Enter sends the trimmed text and clears the box; Shift+Enter and empty do not send", () => {
  const onSend = vi.fn();
  render(<AskView messages={[]} onSend={onSend} />);
  const box = screen.getByLabelText("Message to E.V.") as HTMLTextAreaElement;
  fireEvent.keyDown(box, { key: "Enter" });
  expect(onSend).not.toHaveBeenCalled();
  fireEvent.change(box, { target: { value: "  is it ready? " } });
  fireEvent.keyDown(box, { key: "Enter", shiftKey: true });
  expect(onSend).not.toHaveBeenCalled();
  fireEvent.keyDown(box, { key: "Enter" });
  expect(onSend).toHaveBeenCalledWith("is it ready?");
  expect(box.value).toBe("");
});
