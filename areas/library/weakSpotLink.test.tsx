import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { Detail } from "../../kit/index.ts";
import { weakSpotDetail } from "./WeakSpot.detail.tsx";
import type { LibraryExam, WeakSpot } from "./types.ts";

afterEach(cleanup);

const mastery = { right: 0, shaky: 0, wrong: 1 };
const spot: WeakSpot = {
  id: "ws_1",
  title: "Sodium",
  meta: "2 missed",
  mastery,
  due: "due today",
  goalId: "goal_a",
};
const date = (id: string, kind: string): LibraryExam => ({
  id,
  title: `Date ${id}`,
  meta: "",
  when: "",
  kind,
  mastery,
  readiness: "",
});
const dates = [date("goal_a", "exam"), date("goal_b", "exam"), date("goal_c", "mystery")];

const openPicker = () =>
  fireEvent.keyDown(screen.getByRole("button", { name: "Change date" }), { key: "Enter" });

test("the weak spot Detail shows its date and offers only dates that take weak spots, plus the current one", async () => {
  render(<Detail {...weakSpotDetail({ spot, dates, onLink: vi.fn() })} />);
  expect(screen.getByText("Date goal_a")).toBeTruthy();
  openPicker();
  await waitFor(() => expect(screen.getAllByRole("menuitemradio").length).toBe(3));
  expect(screen.queryByRole("menuitemradio", { name: "Date goal_c" })).toBeNull();
});

test("picking another date or No date reports it", async () => {
  const onLink = vi.fn();
  render(<Detail {...weakSpotDetail({ spot, dates, onLink })} />);
  openPicker();
  fireEvent.click(await screen.findByRole("menuitemradio", { name: "Date goal_b" }));
  expect(onLink).toHaveBeenCalledWith("goal_b");
  cleanup();
  const none = vi.fn();
  render(<Detail {...weakSpotDetail({ spot, dates, onLink: none })} />);
  openPicker();
  fireEvent.click(await screen.findByRole("menuitemradio", { name: "No date" }));
  expect(none).toHaveBeenCalledWith(null);
});
