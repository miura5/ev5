import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { LibraryView } from "./Library.view.tsx";
import { SetEditView } from "./SetEdit.view.tsx";
import { ExamPlanDetail } from "./testHost.tsx";
import { StudyView } from "./Study.view.tsx";

afterEach(cleanup);

test("edit mode changes title, rows, kind, adds and deletes, and finishes", () => {
  const h = {
    onTitle: vi.fn(),
    onKind: vi.fn(),
    onItem: vi.fn(),
    onAddItem: vi.fn(),
    onDeleteItem: vi.fn(),
    onDone: vi.fn(),
  };
  render(
    <SetEditView
      set={{
        id: "s",
        title: "Heart",
        kind: "cards",
        meta: "",
        items: [{ id: "a", front: "Preload", back: "Stretch" }],
      }}
      {...h}
    />,
  );
  const title = screen.getByLabelText("Title");
  fireEvent.change(title, { target: { value: "H" } });
  fireEvent.blur(title);
  expect(h.onTitle).toHaveBeenCalledWith("H");
  fireEvent.change(screen.getByLabelText("Definition 1"), {
    target: { value: "x" },
  });
  expect(h.onItem).toHaveBeenCalledWith("a", { back: "x" });
  fireEvent.click(screen.getByRole("radio", { name: "Steps" }));
  expect(h.onKind).toHaveBeenCalledWith("steps");
  fireEvent.click(screen.getByText("+ card"));
  fireEvent.click(screen.getByLabelText("Delete row 1"));
  expect(h.onAddItem).toHaveBeenCalled();
  expect(h.onDeleteItem).toHaveBeenCalledWith("a");
  fireEvent.click(screen.getByText("Done"));
  expect(h.onDone).toHaveBeenCalled();
});

test("exam plan detail shows proposals dashed and acts on them", () => {
  const onAccept = vi.fn();
  const onDismiss = vi.fn();
  const onReviewPlan = vi.fn();
  render(
    <ExamPlanDetail
      exam={{
        id: "x",
        title: "Exam 3",
        kind: "exam",
        when: "Thursday, Nov 5",
        readiness: "58%",
        plan: "waiting for you",
        proposals: [{ id: "p", text: "Unit conversion drill, 25 min" }],
      }}
      onAccept={onAccept}
      onDismiss={onDismiss}
      onReviewPlan={onReviewPlan}
    />,
  );
  expect(screen.getByText("58%")).toBeTruthy();
  fireEvent.click(screen.getByText("Accept"));
  expect(onAccept).toHaveBeenCalledWith("p");
  fireEvent.click(screen.getByLabelText("Not now"));
  expect(onDismiss).toHaveBeenCalledWith("p");
  fireEvent.click(screen.getByText("Review the prep plan"));
  expect(onReviewPlan).toHaveBeenCalled();
});

test("practice hint appears only when asked", () => {
  render(
    <LibraryView
      practice={{
        title: "Review",
        question: "Q?",
        options: ["a"],
        position: 1,
        total: 2,
        source: "src",
        hint: "Think weight first",
      }}
      weakSpots={[]}
      exams={[]}
    />,
  );
  expect(screen.queryByText("Think weight first")).toBeNull();
  fireEvent.click(screen.getByText("Hint"));
  expect(screen.getByText("Think weight first")).toBeTruthy();
});

test("study asks for the attempt first, reveals with source, rates, and ends", () => {
  const onRate = vi.fn();
  const onLeave = vi.fn();
  render(
    <StudyView
      title="Heart"
      onRate={onRate}
      onLeave={onLeave}
      items={[
        { id: "a", kicker: "Term", front: "Preload", back: "Stretch" },
        {
          id: "b",
          kicker: "Term",
          front: "Afterload",
          back: "Resistance",
          from: "Cycles",
        },
      ]}
    />,
  );
  expect(screen.queryByText("Stretch")).toBeNull();
  fireEvent.click(screen.getByText("Turn over"));
  expect(screen.queryByText("Stretch")).toBeNull();
  fireEvent.change(screen.getByLabelText("Your answer"), {
    target: { value: "filling" },
  });
  fireEvent.click(screen.getByText("Turn over"));
  expect(screen.getByText("Stretch")).toBeTruthy();
  expect(screen.getByText("unverified")).toBeTruthy();
  fireEvent.click(screen.getByText("Good"));
  expect(onRate).toHaveBeenCalledWith("a", "good", "filling");
  fireEvent.click(screen.getByText("Just tell me"));
  expect(screen.getByText(/Logged: you asked/)).toBeTruthy();
  fireEvent.click(screen.getByText("Again"));
  expect(screen.getByText(/1 Good, 1 Again/)).toBeTruthy();
  fireEvent.click(screen.getByText("Back to the set"));
  expect(onLeave).toHaveBeenCalled();
});
