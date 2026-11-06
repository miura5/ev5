import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { buildAnswer } from "./answer.ts";
import { StudyView } from "./Study.view.tsx";
import { useStudy, type LibraryServices } from "./useStudy.ts";

afterEach(cleanup);

test("an answer is a new answers document with the attempt under its item", () => {
  const a = buildAnswer(
    "set-1",
    "q1",
    "good",
    " filling ",
    new Date("2026-11-04T10:15:30Z"),
    "AbC9",
  );
  expect(a.id).toBe("set-1-page-20261104-101530-abc9");
  expect(a.doc).toMatchObject({
    schema: 2,
    writer: "page",
    setId: "set-1",
    answers: {
      q1: {
        "page-20261104-101530-abc9": {
          rating: "good",
          text: "filling",
          at: "2026-11-04T10:15:30Z",
        },
      },
    },
  });
  expect(
    buildAnswer("s", "q", "again", "", new Date(0), "x").doc.answers,
  ).toMatchObject({
    q: { "page-19700101-000000-x": { rating: "again" } },
  });
});

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

test("rating queues the answer then replays; offline the answer stays queued", async () => {
  const queueAnswer = vi.fn().mockResolvedValue(undefined);
  const replay = vi
    .fn()
    .mockResolvedValue({ sent: 0, refused: [], stopped: "offline" });
  render(<Harness services={{ outbox: { queueAnswer, replay } }} />);
  fireEvent.change(screen.getByLabelText("Your answer"), {
    target: { value: "filling" },
  });
  fireEvent.click(screen.getByText("Turn over"));
  fireEvent.click(screen.getByText("Good"));
  await waitFor(() => expect(replay).toHaveBeenCalled());
  expect(queueAnswer).toHaveBeenCalledWith(
    "answers",
    expect.stringMatching(/^set-1-page-/),
    expect.anything(),
  );
  const order = [queueAnswer, replay].map(
    (m) => m.mock.invocationCallOrder[0] ?? 0,
  );
  expect(order[0]).toBeLessThan(order[1] ?? 0);
});
