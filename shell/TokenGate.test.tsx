import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test } from "vitest";
import { Shell } from "./Shell.tsx";
import { TokenGate } from "./TokenGate.tsx";
import { forgetToken, readToken, saveToken, UNAUTHORIZED_EVENT } from "../commands/client.ts";

beforeEach(() => forgetToken());
afterEach(cleanup);

const REFUSED = "That token was not accepted. Paste the app token again.";
const app = (useDifferentToken: () => void) => (
  <>
    <h1>The area</h1>
    <button onClick={useDifferentToken}>Switch</button>
  </>
);
const paste = (value: string) => {
  fireEvent.change(screen.getByLabelText("App token"), { target: { value } });
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
};

test("first visit: the token screen, a password field and the browser-only line, no area", () => {
  render(<TokenGate>{app}</TokenGate>);
  expect((screen.getByLabelText("App token") as HTMLInputElement).type).toBe("password");
  expect(screen.getByText("The token stays in this browser only.")).toBeTruthy();
  expect(screen.queryByText("The area")).toBeNull();
  expect(screen.queryByText(REFUSED)).toBeNull();
});

test("the right token is kept and shows the area", () => {
  render(<TokenGate>{app}</TokenGate>);
  paste("  secret  ");
  expect(screen.getByText("The area")).toBeTruthy();
  expect(readToken()).toBe("secret");
});

test("a refusal returns to the screen with the plain sentence, and a new token gets back in", () => {
  saveToken("old");
  render(<TokenGate>{app}</TokenGate>);
  expect(screen.getByText("The area")).toBeTruthy();
  act(() => {
    window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
  });
  expect(screen.getByText(REFUSED)).toBeTruthy();
  expect(screen.queryByText("The area")).toBeNull();
  paste("new");
  expect(screen.getByText("The area")).toBeTruthy();
  expect(readToken()).toBe("new");
});

test("Use a different token forgets the saved token and shows the screen", () => {
  saveToken("old");
  render(<TokenGate>{app}</TokenGate>);
  fireEvent.click(screen.getByRole("button", { name: "Switch" }));
  expect(screen.getByLabelText("App token")).toBeTruthy();
  expect(readToken()).toBe("");
});

test("the shell shows the control only when it is handed one", () => {
  const areas = [{ id: "today", route: "/", nav: "Today", view: () => <h1>Today view</h1> }];
  const { rerender } = render(<Shell path="/" onNavigate={() => {}} areas={areas} />);
  expect(screen.queryByRole("button", { name: "Use a different token" })).toBeNull();
  let n = 0;
  rerender(<Shell path="/" onNavigate={() => {}} areas={areas} onUseDifferentToken={() => n++} />);
  fireEvent.click(screen.getByRole("button", { name: "Use a different token" }));
  expect(n).toBe(1);
});
