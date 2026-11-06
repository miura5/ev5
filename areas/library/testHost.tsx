import { useEffect, useState } from "react";
import { Detail, type DetailProps } from "../../kit/index.ts";
import { LibraryScreen as RawLibraryScreen } from "./Library.screen.tsx";
import { withToasts } from "../testToasts.tsx";

const LibraryScreen = withToasts(RawLibraryScreen);
import {
  datePlanDetail,
  type ExamPlanDetailProps,
} from "./DatePlan.detail.tsx";

/** Stands in for the shell in tests: holds the Detail the screen opens, closes it on Esc like the shell's host. */
export function LibraryHosted(props: Parameters<typeof LibraryScreen>[0]) {
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
      <LibraryScreen {...props} onDetail={setDetail} />
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
