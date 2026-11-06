import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { buildAnswer } from "./answer.ts";
import { StudyView } from "./Study.view.tsx";

afterEach(cleanup);

const single = {
  id: "q1",
  kicker: "Question",
  front: "Which layer pumps?",
  back: "Myocardium",
  options: ["Endocardium", "Myocardium", "Pericardium"],
};

test("a choice card shows its options and sends the picked option numbers", () => {
  const onRate = vi.fn();
  render(<StudyView title="Heart" items={[single]} onRate={onRate} />);
  fireEvent.click(screen.getByLabelText("Myocardium"));
  fireEvent.click(screen.getByText("Turn over"));
  expect(screen.getByText("You chose: Myocardium")).toBeTruthy();
  fireEvent.click(screen.getByText("Good"));
  expect(onRate).toHaveBeenCalledWith("q1", "good", "1");
});

test("a multi-select card sends every picked number, in order", () => {
  const onRate = vi.fn();
  render(
    <StudyView
      title="Heart"
      items={[{ ...single, multi: true }]}
      onRate={onRate}
    />,
  );
  fireEvent.click(screen.getByLabelText("Pericardium"));
  fireEvent.click(screen.getByLabelText("Endocardium"));
  fireEvent.click(screen.getByText("Turn over"));
  fireEvent.click(screen.getByText("Again"));
  expect(onRate).toHaveBeenCalledWith("q1", "again", "0,2");
});

test("nothing turns over until an option is picked", () => {
  render(<StudyView title="Heart" items={[single]} onRate={vi.fn()} />);
  fireEvent.click(screen.getByText("Turn over"));
  expect(screen.queryByText("Good")).toBeNull();
});

test("the offline fallback stores Again or Good as a rating, never as correct", () => {
  const a = buildAnswer("s", "q", "good", "1", new Date(0), "x");
  const e = (
    a.doc.answers as Record<string, Record<string, Record<string, unknown>>>
  ).q!["page-19700101-000000-x"]!;
  expect(e.rating).toBe("good");
  expect("correct" in e).toBe(false);
});
