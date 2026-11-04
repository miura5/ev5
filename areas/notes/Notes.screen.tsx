import { useState } from "react";
import { call, failureSentence, readToken } from "../../commands/client.ts";
import { centralDate } from "../../domain/index.ts";
import { Toast } from "../../kit/index.ts";
import { NotePageView } from "./NotePage.view.tsx";
import { NoteEditor } from "./parts/NoteEditor.tsx";
import { NotesView } from "./Notes.view.tsx";
import { toPage, toSummary } from "./map.ts";
import { useNotes, type NotesServices } from "./useNotes.ts";

/** The mounted view: notes from the document routes; the title is the note's first heading, edited in place in the editor, and saves through the outbox, so it works offline. */
export function NotesScreen({
  services,
  onNavigate,
}: {
  services?: NotesServices;
  onNavigate?: (path: string) => void;
}) {
  const {
    notes,
    error,
    saveState,
    saveBlocks,
    createNote,
    collections,
    members,
  } = useNotes(services);
  // The palette opens a note with /notes?open=<id>; an unknown id just shows the list.
  const [open, setOpen] = useState<string | undefined>(
    () => new URLSearchParams(window.location.search).get("open") || undefined,
  );
  const [startError, setStartError] = useState<string>();
  const today = centralDate(Date.now());
  const cur = notes.find((n) => n.id === open);
  if (!cur)
    return (
      <>
        {error ? <Toast message={error} /> : null}
        <NotesView
          notes={[...notes]
            .sort((a, b) =>
              (b.note.editedAt ?? b.note.at).localeCompare(
                a.note.editedAt ?? a.note.at,
              ),
            )
            .map((n) => ({
              ...toSummary(n.id, n.note, today),
              collectionId: members.get(n.id) ?? null,
            }))}
          failed={!!error}
          collections={collections}
          onNewNote={() =>
            void createNote().then((id) => {
              if (id) setOpen(id);
            })
          }
          onOpenNote={setOpen}
        />
      </>
    );
  // Starts a study session (the command ends any running one), then opens the Sessions area.
  const startSession = async () => {
    const r = await call("session.start", { noteId: cur.id }, readToken());
    if (!r.ok || r.mode !== "direct") {
      setStartError(r.ok ? failureSentence(500) : r.reason);
      return;
    }
    setStartError(undefined);
    onNavigate?.("/sessions");
  };
  return (
    <>
      {startError ? <Toast message={startError} /> : null}
      <NotePageView
        note={{
          ...toPage(cur.id, cur.note, saveState, today),
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
        onStartSession={() => void startSession()}
      />
    </>
  );
}
