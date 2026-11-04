import { useState } from "react";
import { Toast } from "../../kit/index.ts";
import { NotePageView } from "./NotePage.view.tsx";
import { NoteEditor } from "./parts/NoteEditor.tsx";
import { NotesView } from "./Notes.view.tsx";
import { toPage, toSummary } from "./map.ts";
import { useNotes, type NotesServices } from "./useNotes.ts";

/** The mounted view: notes from the document routes; a title edit saves through the outbox, so it works offline. */
export function NotesScreen({ services }: { services?: NotesServices }) {
  const {
    notes,
    error,
    saveState,
    saveTitle,
    saveBlocks,
    createNote,
    collections,
    members,
  } = useNotes(services);
  const [open, setOpen] = useState<string>();
  const [draft, setDraft] = useState("");
  const cur = notes.find((n) => n.id === open);
  if (!cur)
    return (
      <>
        {error ? <Toast message={error} /> : null}
        <NotesView
          notes={notes
            .map((n) => ({
              ...toSummary(n.id, n.note),
              collectionId: members.get(n.id) ?? null,
            }))
            .sort((a, b) => b.when.localeCompare(a.when))}
          failed={!!error}
          collections={collections}
          onNewNote={() =>
            void createNote().then((id) => {
              if (id) {
                setOpen(id);
                setDraft("Untitled");
              }
            })
          }
          onOpenNote={(id) => {
            setOpen(id);
            setDraft(notes.find((n) => n.id === id)?.note.title ?? "");
          }}
        />
      </>
    );
  return (
    <>
      <form
        className="ev-notes-titleedit"
        onSubmit={(e) => {
          e.preventDefault();
          void saveTitle(cur.id, draft);
        }}
      >
        <label className="ev-notes-meta" htmlFor="ev-note-title">
          Title
        </label>
        <input
          id="ev-note-title"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        <button type="submit">Save</button>
      </form>
      <NotePageView
        note={{
          ...toPage(cur.id, cur.note, saveState),
          collectionName:
            collections.find((c) => c.id === members.get(cur.id))?.title ??
            cur.note.course ??
            null,
        }}
        editor={
          <NoteEditor
            blocks={cur.note.blocks}
            onChange={(b) => void saveBlocks(cur.id, b)}
          />
        }
        onBack={() => setOpen(undefined)}
      />
    </>
  );
}
