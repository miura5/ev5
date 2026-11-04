import { useState } from "react";
import { Detail, Toast } from "../../kit/index.ts";
import { LibraryView } from "./Library.view.tsx";
import { StudyView } from "./Study.view.tsx";
import { ExamPlanDetail } from "./ExamPlan.detail.tsx";
import { SetPageView } from "./SetPage.view.tsx";
import { useLibrary } from "./useLibrary.ts";
import { useStudy, useTellMe, type LibraryServices } from "./useStudy.ts";

/** The id the palette asks to open: /library?open=<id> (shell/findings.ts); anything else is nothing. */
function openFromUrl(): string | undefined {
  try {
    return new URLSearchParams(window.location.search).get("open") || undefined;
  } catch {
    return undefined;
  }
}

/** The mounted view: exams, weak spots and sets from /api/v1/docs; opening a set shows its page. */
export function LibraryScreen({ services }: { services?: LibraryServices }) {
  const { data, token, refused, error } = useLibrary(services?.readCopy);
  const [open, setOpen] = useState<string | undefined>(openFromUrl);
  const [studying, setStudying] = useState(false);
  const onRate = useStudy(open ?? "", services);
  const onTell = useTellMe(open ?? "", services);
  // No token, or one the server refused: the shell's token screen asks for it; show nothing, never an empty library.
  if (!token || refused) return null;
  // First data still on its way: the heading and a loading line, never an empty pane.
  if (!data && !error)
    return (
      <section className="ev-library" aria-label="Library">
        <div className="ev-library-head">
          <h1 className="ev-library-title">Library</h1>
          <span className="ev-library-meta">Loading…</span>
        </div>
      </section>
    );
  const page = open ? data?.pages[open] : undefined;
  if (page && studying)
    return (
      <StudyView
        title={page.title}
        items={page.items.map((it) => ({
          id: it.id,
          kicker: "Question",
          front: it.front,
          back: it.back ?? "",
        }))}
        onRate={onRate}
        onTell={onTell}
        onLeave={() => setStudying(false)}
      />
    );
  if (page)
    return (
      <SetPageView
        set={page}
        onStudy={() => setStudying(true)}
        onBack={() => setOpen(undefined)}
      />
    );
  const exam = open ? data?.exams.find((x) => x.id === open) : undefined;
  const spot = open ? data?.weakSpots.find((w) => w.id === open) : undefined;
  return (
    <>
      {exam ? (
        <ExamPlanDetail
          exam={{
            id: exam.id,
            title: exam.title,
            when: exam.meta,
            course: "",
            readiness: exam.readiness || "none yet",
            plan: "no plan yet",
            proposals: [],
          }}
          onClose={() => setOpen(undefined)}
        />
      ) : null}
      {spot ? (
        <Detail
          title={spot.title}
          onClose={() => setOpen(undefined)}
          properties={[
            { label: "Course", value: spot.meta },
            { label: "Next", value: spot.due },
          ]}
        />
      ) : null}
      {error ? <Toast message={error} /> : null}
      <LibraryView
        practice={null}
        weakSpots={data?.weakSpots ?? []}
        exams={data?.exams ?? []}
        sets={data?.sets ?? []}
        onOpenSet={setOpen}
        onOpenExam={setOpen}
        onDrill={setOpen}
      />
    </>
  );
}
