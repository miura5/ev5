import { useEffect, useState } from "react";
import { Detail, type DetailProps } from "../../kit/index.ts";
import { LibraryScreen as RawLibraryScreen } from "./Library.screen.tsx";
import type {
  AttemptRow,
  GoalRow,
  SetItemRow,
  SetTableRow,
  LinkRow,
  WeakSpotEventRow,
  WeakSpotTableRow,
} from "../../domain/index.ts";
import { withToasts } from "../testToasts.tsx";

const LibraryScreen = withToasts(RawLibraryScreen);
import {
  datePlanDetail,
  type ExamPlanDetailProps,
} from "./DatePlan.detail.tsx";

/** A goal row as GET /goals returns it (an open one by default); tests pass what they care about. */
export const goalRow = (over: Partial<GoalRow> = {}): GoalRow => ({
  id: "x1",
  collection_id: null,
  title: "Exam Three",
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

/** A weak spot row as GET /weak-spots returns it; tests pass what they care about. */
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

/** An event row (a reopen by default) as GET /weak-spot-events returns it. */
export const eventRow = (
  spot: string,
  n: number,
  over: Partial<WeakSpotEventRow> = {},
): WeakSpotEventRow => ({
  id: `wse_${spot}_${n}`,
  weak_spot_id: spot,
  type: "reopen",
  by: "user",
  note: null,
  objective_id: null,
  until: null,
  at: Date.parse("2026-11-01T15:00:00Z") + n * 1000,
  v: 1,
  ...over,
});

/** A link row (a spot or objective to a goal) as GET /links returns it. */
export const linkRow = (
  from_kind: "weak_spot" | "objective",
  from_id: string,
  to_id: string,
): LinkRow => ({
  id: `link_${from_id}`,
  from_kind,
  from_id,
  to_kind: "goal",
  to_id,
  by: "user",
  note: null,
  at: 1,
  v: 1,
  deleted_at: null,
});

/** A set row as GET /sets returns it. */
export const setRow = (over: Partial<SetTableRow> = {}): SetTableRow => ({
  id: "set_1",
  collection_id: null,
  kind: "drill",
  title: "Doses",
  source_kind: null,
  source_id: null,
  created_by: "user",
  job_id: null,
  focus: null,
  asked: null,
  at: 1,
  v: 1,
  deleted_at: null,
  ...over,
});

/** A single-choice item row as GET /items returns it (the body is the item without its id). */
export const itemRow = (
  id: string,
  set_id: string,
  body: SetItemRow["body"],
  over: Partial<SetItemRow> = {},
): SetItemRow => ({
  id,
  set_id,
  pos: 1,
  type: "single",
  body,
  objective_id: null,
  weak_spot_id: null,
  source_ref: null,
  at: 1,
  v: 1,
  deleted_at: null,
  ...over,
});

/** An attempts row as GET /attempts returns it; a score of null is an unchecked answer. */
export const attemptRow = (
  set_id: string,
  item_id: string,
  at: string,
  score: number | null,
): AttemptRow => ({
  id: `att_${set_id}_${item_id}_${at}`,
  item_id,
  item_v: 1,
  set_id,
  session_id: null,
  source: "run",
  how: score === null ? "told" : "chose",
  answer: null,
  score,
  was_due: null,
  answered_at: Date.parse(at),
  at: Date.parse(at),
  v: 1,
});

/** Stands in for the shell in tests: holds the Detail the screen opens, closes it on Esc like the shell's host. */
export function LibraryHosted(props: Parameters<typeof LibraryScreen>[0]) {
  const [detail, setDetail] = useState<DetailProps | null>(null);
  // The address the shell would hold: opening or closing a set moves it.
  const [search, setSearch] = useState(props.search ?? "");
  const onNavigate = (to: string) =>
    setSearch(to.split("?").slice(1).join("?"));
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
      <LibraryScreen
        {...props}
        search={search}
        onNavigate={onNavigate}
        onDetail={setDetail}
      />
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

/** The exam plan Detail drawn as the shell's host draws it. */
export function ExamPlanDetail(props: ExamPlanDetailProps) {
  return <Detail {...datePlanDetail(props)} />;
}
