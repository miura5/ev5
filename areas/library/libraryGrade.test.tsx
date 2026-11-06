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
import { gradeFailure, useGrade } from "./useStudy.ts";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function Harness() {
  const onGrade = useGrade("set-1");
  return (
    <StudyView
      title="Heart"
      onGrade={onGrade}
      onRate={vi.fn()}
      items={[
        {
          id: "q1",
          kicker: "Question",
          front: "Name the layers",
          back: "Three layers",
          open: true,
        },
      ]}
    />
  );
}

const answer = (text: string) => {
  fireEvent.change(screen.getByLabelText("Your answer"), {
    target: { value: text },
  });
  fireEvent.click(screen.getByText("Turn over"));
};

test("a typed open answer goes to study.attempt whole and shows the score, not Again or Good", async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValue(
      new Response(
        JSON.stringify({
          mode: "direct",
          result: { score: 0.85, correct: true, note: "Name the tissue." },
        }),
        { status: 200 },
      ),
    );
  vi.stubGlobal("fetch", fetchMock);
  render(<Harness />);
  const long = "x".repeat(900);
  answer(long);
  await waitFor(() =>
    expect(screen.getByText(/Good: 85%\. Name the tissue\./)).toBeTruthy(),
  );
  const [url, init] = fetchMock.mock.calls[0] as [string, { body: string }];
  expect(url).toContain("commands/study.attempt");
  expect(JSON.parse(init.body)).toEqual({
    input: { id: "set-1/q1", answer: long },
  });
  expect(screen.queryByText("Again")).toBeNull();
  expect(screen.getByText("Next")).toBeTruthy();
});

test.each([
  [400, /too long/],
  [429, /limit/],
  [502, /could not grade/],
  [503, /online/],
])(
  "a %i from the grader says so in a plain sentence and keeps the answer",
  async (status, re) => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("{}", { status })),
    );
    render(<Harness />);
    answer("my answer");
    await waitFor(() => expect(screen.getByText(re)).toBeTruthy());
    expect(
      (screen.getByLabelText("Your answer") as HTMLInputElement).value,
    ).toBe("my answer");
    expect(screen.queryByText("Good")).toBeNull();
  },
);

test("offline, the sentence says open answers need a connection", () => {
  expect(gradeFailure(0)).toMatch(/online/);
});

test("a choice item keeps the self-rating path", () => {
  const onGrade = vi.fn();
  render(
    <StudyView
      title="H"
      onGrade={onGrade}
      items={[{ id: "q", kicker: "Question", front: "F", back: "B" }]}
    />,
  );
  answer("a");
  expect(onGrade).not.toHaveBeenCalled();
  expect(screen.getByText("Good")).toBeTruthy();
});

test("a long answer in the ev4 document says it was cut, with its length", () => {
  const a = buildAnswer("s", "q", "good", "y".repeat(700), new Date(0), "x");
  const e = (
    a.doc.answers as Record<string, Record<string, Record<string, unknown>>>
  ).q!["page-19700101-000000-x"]!;
  expect(e.textCut).toBe(true);
  expect(e.textLength).toBe(700);
  expect((e.text as string).length).toBe(600);
});
