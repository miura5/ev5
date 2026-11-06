import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { libraryArea } from "./area.ts";
import {
  LibraryView,
  type LibraryExam,
  type LibrarySet,
  type PracticeSession,
  type WeakSpot,
} from "./Library.view.tsx";
import { SetPageView } from "./SetPage.view.tsx";

afterEach(cleanup);

const mastery = { right: 4, shaky: 2, wrong: 3 };
const practice: PracticeSession = {
  title: "Morning review",
  question: "How many mL per dose?",
  options: ["2.75 mL", "5.5 mL"],
  position: 1,
  total: 8,
  source: "Biology 101 · dosage by weight",
};
const weak: WeakSpot[] = [
  {
    id: "w",
    title: "Oral liquid doses",
    meta: "Biology 101 · 4 of 9",
    mastery,
    due: "due today",
  },
];
const exams: LibraryExam[] = [
  {
    id: "x",
    title: "Biology 101 · Exam 3",
    kind: "exam",
    meta: "Thursday",
    when: "Thursday",
    mastery,
    readiness: "58%",
  },
];

test("practice commits the chosen option and ends", () => {
  const onCommit = vi.fn();
  const onEnd = vi.fn();
  render(
    <LibraryView
      practice={practice}
      weakSpots={weak}
      exams={exams}
      onCommit={onCommit}
      onEndPractice={onEnd}
    />,
  );
  expect(screen.getByText("1 of 8")).toBeTruthy();
  fireEvent.click(screen.getByLabelText("5.5 mL"));
  fireEvent.click(screen.getByText("Commit answer"));
  expect(onCommit).toHaveBeenCalledWith("5.5 mL");
  fireEvent.click(screen.getByText("End"));
  expect(onEnd).toHaveBeenCalled();
  expect(libraryArea.nav).toBe("Library");
});

test("tabs show weak spots and exams with counts, rows open", () => {
  const onDrill = vi.fn();
  const onOpenExam = vi.fn();
  render(
    <LibraryView
      practice={null}
      weakSpots={weak}
      exams={exams}
      onDrill={onDrill}
      onOpenExam={onOpenExam}
    />,
  );
  expect(screen.getByText("No practice running.")).toBeTruthy();
  fireEvent.click(screen.getByRole("radio", { name: /Weak spots/ }));
  fireEvent.click(screen.getByText("Oral liquid doses"));
  expect(onDrill).toHaveBeenCalledWith("w");
  fireEvent.click(screen.getByRole("radio", { name: /Dates/ }));
  expect(screen.getByText("58%")).toBeTruthy();
  fireEvent.click(screen.getByText("Biology 101 · Exam 3"));
  expect(onOpenExam).toHaveBeenCalledWith("x");
});

test("empty tabs say so", () => {
  render(<LibraryView practice={null} weakSpots={[]} exams={[]} />);
  fireEvent.click(screen.getByRole("radio", { name: /Weak spots/ }));
  expect(screen.getByText("No weak spots.")).toBeTruthy();
  fireEvent.click(screen.getByRole("radio", { name: /Dates/ }));
  expect(screen.getByText("No dates.")).toBeTruthy();
});

test("sets tab filters tiles by type and opens a set; accuracy line shows", () => {
  const onOpenSet = vi.fn();
  const sets: LibrarySet[] = [
    {
      id: "s1",
      title: "Heart",
      kind: "cards",
      meta: "Economics 101 · 24 cards",
      due: "6 due",
    },
    {
      id: "s2",
      title: "Unit conversion",
      kind: "questions",
      meta: "Biology 101 · 10 questions",
    },
  ];
  render(
    <LibraryView
      practice={null}
      weakSpots={[]}
      exams={[]}
      sets={sets}
      accuracy={{ text: "72%, up from 66%" }}
      onOpenSet={onOpenSet}
    />,
  );
  expect(screen.getByText("72%, up from 66%")).toBeTruthy();
  fireEvent.click(screen.getByRole("radio", { name: /Sets/ }));
  fireEvent.click(screen.getByRole("radio", { name: /Questions/ }));
  expect(screen.queryByText("Heart")).toBeNull();
  fireEvent.click(screen.getByText("Unit conversion"));
  expect(onOpenSet).toHaveBeenCalledWith("s2");
  fireEvent.click(screen.getByRole("radio", { name: /Steps/ }));
  expect(screen.getByText("No steps sets yet.")).toBeTruthy();
});

test("set page lists items with answers and starts study", () => {
  const onStudy = vi.fn();
  render(
    <SetPageView
      set={{
        id: "s1",
        title: "Heart",
        kind: "cards",
        meta: "1 card",
        items: [
          { id: "a", front: "Preload", back: "Stretch at end of filling" },
        ],
      }}
      onStudy={onStudy}
    />,
  );
  expect(screen.getByText("Stretch at end of filling")).toBeTruthy();
  fireEvent.click(screen.getByText("Study"));
  expect(onStudy).toHaveBeenCalled();
});
