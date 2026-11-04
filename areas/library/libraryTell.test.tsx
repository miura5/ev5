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
import { useTellMe, type LibraryServices } from "./useStudy.ts";

afterEach(cleanup);

test("a told answer is an append-only attempt with outcome told", () => {
  const a = buildAnswer(
    "set-1",
    "q1",
    "told",
    "",
    new Date("2026-11-04T10:15:30Z"),
    "AbC9",
  );
  expect(a.doc.answers).toEqual({
    q1: {
      "page-20261104-101530-abc9": {
        outcome: "told",
        at: "2026-11-04T10:15:30Z",
      },
    },
  });
});

function Harness({ services }: { services: LibraryServices }) {
  const onTell = useTellMe("set-1", services);
  return (
    <StudyView
      title="Heart"
      onTell={onTell}
      items={[{ id: "q1", kicker: "Question", front: "F", back: "The back" }]}
    />
  );
}

test("Just tell me queues one told answer, then shows the back", async () => {
  const queueAnswer = vi.fn().mockResolvedValue(undefined);
  const replay = vi.fn().mockResolvedValue(undefined);
  render(<Harness services={{ outbox: { queueAnswer, replay } }} />);
  fireEvent.click(screen.getByText("Just tell me"));
  await waitFor(() => expect(screen.getByText("The back")).toBeTruthy());
  expect(queueAnswer).toHaveBeenCalledTimes(1);
  expect(queueAnswer.mock.calls[0]?.[0]).toBe("answers");
  expect(JSON.stringify(queueAnswer.mock.calls[0]?.[2])).toContain(
    '"outcome":"told"',
  );
});

test("if the event cannot be queued the back stays hidden", async () => {
  const queueAnswer = vi.fn().mockRejectedValue(new Error("full"));
  render(<Harness services={{ outbox: { queueAnswer, replay: vi.fn() } }} />);
  fireEvent.click(screen.getByText("Just tell me"));
  await waitFor(() => expect(queueAnswer).toHaveBeenCalled());
  expect(screen.queryByText("The back")).toBeNull();
});
