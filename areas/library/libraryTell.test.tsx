import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { StudyView } from "./Study.view.tsx";
import { useTellMe, type LibraryServices } from "./useStudy.ts";

afterEach(cleanup);

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
  const replay = vi.fn().mockResolvedValue(undefined);
  render(<Harness services={{ outbox: { queueCommand, replay } }} />);
  fireEvent.click(screen.getByText("Just tell me"));
  await waitFor(() => expect(screen.getByText("The back")).toBeTruthy());
  const [name, id, input] = queueCommand.mock.calls[0] ?? [];
  expect(name).toBe("study.just_tell_me");
  expect(id).toMatch(/^att_[0-9a-f]{24}$/);
  expect(input).toEqual({ id: "set-1/q1", attempt: id });
});

test("if the event cannot be queued the back stays hidden", async () => {
  const queueCommand = vi.fn().mockRejectedValue(new Error("full"));
  render(<Harness services={{ outbox: { queueCommand, replay: vi.fn() } }} />);
  fireEvent.click(screen.getByText("Just tell me"));
  await waitFor(() => expect(queueCommand).toHaveBeenCalled());
  expect(screen.queryByText("The back")).toBeNull();
});

test("a rating posts study.attempt with the rating and a client att_ id", async () => {
  const queueCommand = vi.fn().mockResolvedValue(undefined);
  const replay = vi.fn().mockResolvedValue(undefined);
  const { useStudy } = await import("./useStudy.ts");
  function H() {
    const onRate = useStudy("set-1", {
      outbox: { queueCommand, replay },
    });
    return <button onClick={() => onRate("q1", "good", "typed")}>rate</button>;
  }
  render(<H />);
  fireEvent.click(screen.getByText("rate"));
  await waitFor(() => expect(queueCommand).toHaveBeenCalled());
  const [name, id, input] = queueCommand.mock.calls[0] ?? [];
  expect(name).toBe("study.attempt");
  expect(id).toMatch(/^att_[0-9a-f]{24}$/);
  expect(input).toEqual({
    id: "set-1/q1",
    answer: "typed",
    rating: "good",
    attempt: id,
  });
});
