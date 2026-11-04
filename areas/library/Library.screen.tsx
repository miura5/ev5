import { useState } from "react";
import { Toast } from "../../kit/index.ts";
import { LibraryView } from "./Library.view.tsx";
import { StudyView } from "./Study.view.tsx";
import { SetPageView } from "./SetPage.view.tsx";
import { useLibrary } from "./useLibrary.ts";
import { useStudy, useTellMe, type LibraryServices } from "./useStudy.ts";

/** The mounted view: exams, weak spots and sets from /api/v1/docs; opening a set shows its page. */
export function LibraryScreen({ services }: { services?: LibraryServices }) {
  const { data, error } = useLibrary(services?.readCopy);
  const [open, setOpen] = useState<string>();
  const [studying, setStudying] = useState(false);
  const onRate = useStudy(open ?? "", services);
  const onTell = useTellMe(open ?? "", services);
  // No data and no failure yet (loading, or the shell's token screen is up): show nothing, never an empty library.
  if (!data && !error) return null;
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
  return (
    <>
      {error ? <Toast message={error} /> : null}
      <LibraryView
        practice={null}
        weakSpots={data?.weakSpots ?? []}
        exams={data?.exams ?? []}
        sets={data?.sets ?? []}
        onOpenSet={setOpen}
      />
    </>
  );
}
