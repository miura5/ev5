import { useEffect, useState } from "react";
import { Detail, type DetailProps } from "../../kit/index.ts";
import { LibraryScreen as RawLibraryScreen } from "./Library.screen.tsx";
import type {
  GoalRow,
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
