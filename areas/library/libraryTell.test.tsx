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

test("Just tell me posts study.just_tell_me under a client att_ id when the outbox can", async () => {
  const queueCommand = vi.fn().mockResolvedValue(undefined);
  const queueAnswer = vi.fn();
  const replay = vi.fn().mockResolvedValue(undefined);
  render(<Harness services={{ outbox: { queueCommand, queueAnswer, replay } }} />);
  fireEvent.click(screen.getByText("Just tell me"));
  await waitFor(() => expect(screen.getByText("The back")).toBeTruthy());
  expect(queueAnswer).not.toHaveBeenCalled();
  const [name, id, input] = queueCommand.mock.calls[0] ?? [];
  expect(name).toBe("study.just_tell_me");
  expect(id).toMatch(/^att_[0-9a-f]{24}$/);
  expect(input).toEqual({ id: "set-1/q1", attempt: id });
});

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
