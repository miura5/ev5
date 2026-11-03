import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { Ev4Offer } from "./Ev4Offer.tsx";
import type { Services } from "./services.ts";

afterEach(cleanup);

const entry = { c: "notes", id: "n1", doc: { title: "Heart" }, base: 3 };
const make = (found: unknown[]) => {
  const ev4 = {
    find: vi.fn(async () => found as never[]),
    accept: vi.fn(async (e: unknown[]) => ({ queued: e.length })),
    decline: vi.fn(),
  } satisfies NonNullable<Services["ev4"]>;
  return ev4;
};

test("nothing is shown or queued when ev4 left nothing", async () => {
  const ev4 = make([]);
  render(<Ev4Offer ev4={ev4} />);
  await waitFor(() => expect(ev4.find).toHaveBeenCalled());
  expect(document.querySelector("[data-ui='ev4-offer']")).toBeNull();
  expect(ev4.accept).not.toHaveBeenCalled();
});

test("a found outbox is offered and nothing is queued until yes", async () => {
  const ev4 = make([entry]);
  render(<Ev4Offer ev4={ev4} />);
  await screen.findByText(/left 1 unsent note/);
  expect(ev4.accept).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: /Yes/ }));
  await screen.findByText(/Queued 1 note/);
  expect(ev4.accept).toHaveBeenCalledWith([entry]);
});

test("no thanks queues nothing and closes the offer", async () => {
  const ev4 = make([entry]);
  render(<Ev4Offer ev4={ev4} />);
  fireEvent.click(await screen.findByRole("button", { name: "No thanks" }));
  expect(ev4.decline).toHaveBeenCalled();
  expect(ev4.accept).not.toHaveBeenCalled();
  expect(document.querySelector("[data-ui='ev4-offer']")).toBeNull();
});

test("a failed import keeps the offer so nothing is lost", async () => {
  const ev4 = make([entry]);
  ev4.accept.mockRejectedValueOnce(new Error("disk"));
  render(<Ev4Offer ev4={ev4} />);
  fireEvent.click(await screen.findByRole("button", { name: /Yes/ }));
  await screen.findByText(/did not work/);
  expect(screen.getByRole("button", { name: /Yes/ })).toBeTruthy();
});
