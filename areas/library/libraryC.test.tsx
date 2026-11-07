import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { StudyView } from "./Study.view.tsx";
import { useStudy, type LibraryServices } from "./useStudy.ts";

afterEach(cleanup);

function Harness({ services }: { services: LibraryServices }) {
  const onRate = useStudy("set-1", services);
  return (
    <StudyView
      title="Heart"
      onRate={onRate}
      items={[{ id: "q1", kicker: "Question", front: "F", back: "B" }]}
    />
  );
}

test("rating queues study.attempt then replays; offline the answer stays queued", async () => {
  const queueCommand = vi.fn().mockResolvedValue(undefined);
  const replay = vi
    .fn()
    .mockResolvedValue({ sent: 0, refused: [], stopped: "offline" });
  render(<Harness services={{ outbox: { queueCommand, replay } }} />);
  fireEvent.change(screen.getByLabelText("Your answer"), {
    target: { value: "filling" },
  });
  fireEvent.click(screen.getByText("Turn over"));
  fireEvent.click(screen.getByText("Good"));
  await waitFor(() => expect(replay).toHaveBeenCalled());
  expect(queueCommand).toHaveBeenCalledWith(
    "study.attempt",
    expect.stringMatching(/^att_/),
    expect.objectContaining({ id: "set-1/q1", rating: "good" }),
  );
  const order = [queueCommand, replay].map(
    (m) => m.mock.invocationCallOrder[0] ?? 0,
  );
  expect(order[0]).toBeLessThan(order[1] ?? 0);
});
