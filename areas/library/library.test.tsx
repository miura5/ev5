import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { libraryArea } from "./area.ts";
import {
  LibraryView,
  type LibraryExam,
  type PracticeSession,
  type WeakSpot,
} from "./Library.view.tsx";

afterEach(cleanup);

const mastery = { right: 4, shaky: 2, wrong: 3 };
const practice: PracticeSession = {
  title: "Morning review",
  question: "How many mL per dose?",
  options: ["2.75 mL", "5.5 mL"],
  position: 1,
  total: 8,
  source: "NUR 112 · dosage by weight",
};
const weak: WeakSpot[] = [
  {
    id: "w",
    title: "Oral liquid doses",
    meta: "NUR 112 · 4 of 9",
    mastery,
    due: "due today",
  },
];
const exams: LibraryExam[] = [
  {
    id: "x",
    title: "NUR 112 · Exam 3",
    meta: "Thursday",
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
  fireEvent.click(screen.getByRole("tab", { name: /Weak spots/ }));
  fireEvent.click(screen.getByText("Oral liquid doses"));
  expect(onDrill).toHaveBeenCalledWith("w");
  fireEvent.click(screen.getByRole("tab", { name: /Exams/ }));
  expect(screen.getByText("58%")).toBeTruthy();
  fireEvent.click(screen.getByText("NUR 112 · Exam 3"));
  expect(onOpenExam).toHaveBeenCalledWith("x");
});

test("empty tabs say so", () => {
  render(<LibraryView practice={null} weakSpots={[]} exams={[]} />);
  fireEvent.click(screen.getByRole("tab", { name: /Weak spots/ }));
  expect(screen.getByText("No weak spots.")).toBeTruthy();
  fireEvent.click(screen.getByRole("tab", { name: /Exams/ }));
  expect(screen.getByText("No exams.")).toBeTruthy();
});
