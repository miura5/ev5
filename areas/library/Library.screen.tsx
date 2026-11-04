import { useState } from "react";
import { LibraryView } from "./Library.view.tsx";
import { StudyView } from "./Study.view.tsx";
import { SetPageView } from "./SetPage.view.tsx";
import { useLibrary } from "./useLibrary.ts";
import { useStudy, useTellMe, type LibraryServices } from "./useStudy.ts";

/** The mounted view: exams, weak spots and sets from /api/v1/docs; opening a set shows its page. */
export function LibraryScreen({ services }: { services?: LibraryServices }) {
  const { data, token, error, setToken } = useLibrary(services?.readCopy);
  const [draft, setDraft] = useState("");
  const [open, setOpen] = useState<string>();
  const [studying, setStudying] = useState(false);
  const onRate = useStudy(open ?? "", services);
  const onTell = useTellMe(open ?? "", services);
  if (!token)
    return (
      <form
        className="ev-library"
        onSubmit={(e) => {
          e.preventDefault();
          if (draft.trim()) setToken(draft.trim());
        }}
      >
        <label className="ev-library-meta" htmlFor="ev-token">
          Paste your app token to see Library
        </label>
        <input
          id="ev-token"
          type="password"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
      </form>
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
  return (
    <>
      {error ? <p className="ev-library-meta">{error}</p> : null}
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
