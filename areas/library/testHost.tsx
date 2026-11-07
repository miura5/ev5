import { useEffect, useState } from "react";
import { Detail, type DetailProps } from "../../kit/index.ts";
import { LibraryScreen as RawLibraryScreen } from "./Library.screen.tsx";
import type { GoalRow } from "../../domain/index.ts";
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
