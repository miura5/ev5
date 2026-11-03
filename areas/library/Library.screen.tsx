import { useState } from "react";
import { LibraryView } from "./Library.view.tsx";
import { SetPageView } from "./SetPage.view.tsx";
import { useLibrary } from "./useLibrary.ts";

/** The mounted view: exams, weak spots and sets from /api/v1/docs; opening a set shows its page. */
export function LibraryScreen() {
  const { data, token, error, setToken } = useLibrary();
  const [draft, setDraft] = useState("");
  const [open, setOpen] = useState<string>();
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
  if (page) return <SetPageView set={page} onBack={() => setOpen(undefined)} />;
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
