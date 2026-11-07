import { useEffect, useState } from "react";
import { Detail, type DetailProps } from "../../kit/index.ts";
import { TodayScreen as RawTodayScreen } from "./Today.screen.tsx";
import type { GoalRow, WeakSpotTableRow } from "../../domain/index.ts";
import type { PlanItemRow, PlanRow } from "./plans.ts";
import { withToasts } from "../testToasts.tsx";

const TodayScreen = withToasts(RawTodayScreen);

/** Stands in for the shell in tests: holds the Detail the screen opens, closes it on Esc like the shell's host. */
export function TodayHosted(props: Parameters<typeof TodayScreen>[0]) {
  const [detail, setDetail] = useState<DetailProps | null>(null);
  useEffect(() => {
    if (!detail) return;
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDetail(null);
    };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [detail]);
  return (
    <>
      <TodayScreen {...props} onDetail={setDetail} />
      {detail ? (
        <Detail
          {...detail}
          onClose={() => {
            detail.onClose?.();
            setDetail(null);
          }}
        />
      ) : null}
    </>
  );
}

/** A goal row as GET /goals returns it (an open one by default); tests pass what they care about. */
export const goalRow = (over: Partial<GoalRow> = {}): GoalRow => ({
  id: "e3",
  collection_id: null,
  title: "Exam 3",
  kind: "exam",
  date: "2099-01-05",
  status: "open",
  score: null,
  created_by: "user",
  at: 1,
  v: 1,
  deleted_at: null,
  ...over,
});

/** A weak spot row as GET /weak-spots returns it. */
export const spotRow = (
  over: Partial<WeakSpotTableRow> = {},
): WeakSpotTableRow => ({
  id: "ws_1",
  collection_id: null,
  objective_id: null,
  topic: "Oral doses",
  kind: "concept",
  words: null,
  source_line: "test",
  duplicate_of: null,
  proposed: 0,
  created_by: "user",
  pre_read: 0,
  reading_due: null,
  at: 1,
  v: 1,
  deleted_at: null,
  ...over,
});

/** A plans row as GET /plans returns it (in force by default). */
export const planRow = (over: Partial<PlanRow> = {}): PlanRow => ({
  id: "plan_p1",
  goal_id: "e3",
  job_id: null,
  state: "in_force",
  title: null,
  from_day: "2026-01-01",
  to_day: "2099-01-01",
  summary: null,
  at: 1,
  v: 1,
  deleted_at: null,
  ...over,
});

/** A plan_items row as GET /plan-items returns it: one Matt added, with no plan, by default. */
export const itemRow = (over: Partial<PlanItemRow> = {}): PlanItemRow => ({
  id: "pli_a",
  plan_id: null,
  day: "2026-11-03",
  pos: 1,
  title: "Review",
  minutes: null,
  time: null,
  origin: "user",
  linked_kind: null,
  linked_id: null,
  repeat_id: null,
  done_at: null,
  at: 1,
  v: 3,
  deleted_at: null,
  ...over,
});

/** The row routes' answer to `url`: the rows given for its path, else none (`{ rows }`, as the server sends). */
export function rowsAnswer(
  url: string,
  by: Record<string, unknown[]> = {},
): Response {
  const path = url.split("?")[0]?.split("/").pop() ?? "";
  return new Response(JSON.stringify({ rows: by[path] ?? [] }));
}
