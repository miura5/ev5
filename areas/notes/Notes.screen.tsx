import { useState } from "react";
import { call, failureSentence, readToken } from "../../commands/client.ts";
import { centralDate, type Block } from "../../domain/index.ts";
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
    ready,
    error,
    saveState,
    saveBlocks,
    saveTitle,
    createNote,
    collections,
    members,
    reload,
  } = useNotes(services);
  // The palette opens a note with /notes?open=<id>; an unknown id just shows the list.
  const [open, setOpen] = useState<string | undefined>(
    () => new URLSearchParams(window.location.search).get("open") || undefined,
  );
  const [startError, setStartError] = useState<string>();
  // Set by New note: the page opens with its title selected, ready to type.
  const [fresh, setFresh] = useState<string>();
  // Set after a delete (here, or on a collection page that sent us with ?deleted=): Undo restores it.
  const [undo, setUndo] = useState<{ id: string; message: string } | undefined>(
    () => {
      const q = new URLSearchParams(window.location.search);
      const id = q.get("deleted");
      if (!id) return undefined;
      return {
        id,
        message:
          q.get("what") === "collection" ? "Collection deleted" : "Deleted",
      };
    },
  );
  const undoToast = undo ? (
    <Toast
      message={undo.message}
      onDone={() => setUndo(undefined)}
      onUndo={() =>
        void call("item.restore", { id: undo.id }, readToken()).then((r) => {
          setUndo(undefined);
          if (r.ok) reload();
          else setStartError(r.reason);
        })
      }
    />
  ) : null;
  const del = (id: string, what: string) =>
    void call("item.delete", { id }, readToken()).then((r) => {
      if (!r.ok) return setStartError(r.reason);
      setOpen(undefined);
      setUndo({ id, message: what });
      reload();
    });
  const move = (id: string, collection: string) =>
    void call("item.move", { id, collection }, readToken()).then((r) => {
      if (!r.ok) return setStartError(r.reason);
      reload();
    });
  const today = centralDate(Date.now());
  // A note opens for editing only from the server's answer, never from the saved copy the list opens on.
  const cur = ready ? notes.find((n) => n.id === open) : undefined;
  if (!cur)
    return (
      <>
        {error || startError ? (
          <Toast message={(error ?? startError)!} />
        ) : null}
        {undoToast}
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
              if (id) {
                setFresh(id);
                setOpen(id);
              }
            })
          }
          onNewCollection={() =>
            void call(
              "collection.create",
              { title: "Untitled collection" },
              readToken(),
            ).then((r) => {
              const id = (
                r.ok ? (r.result as { collection?: { id?: string } }) : {}
              ).collection?.id;
              if (id)
                onNavigate?.(`/collection/${encodeURIComponent(id)}?new=1`);
              else setStartError(r.ok ? failureSentence(500) : r.reason);
            })
          }
          onOpenNote={setOpen}
          onMove={(id, collection) => move(id, collection)}
          onRowAction={(id, action) => {
            if (action === "open") return setOpen(id);
            if (action === "delete") return del(id, "Note deleted");
            void call(`item.${action}`, { id }, readToken()).then((r) => {
              if (!r.ok) setStartError(r.reason);
            });
          }}
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
  // The title is its own field above the editor: the leading heading block is kept out of the editor and put back on save.
  const titled = cur.note.blocks[0]?.type === "h1";
  return (
    <>
      {startError ? <Toast message={startError} /> : null}
      {undoToast}
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
            blocks={titled ? cur.note.blocks.slice(1) : cur.note.blocks}
            onChange={(b) =>
              void saveBlocks(
                cur.id,
                titled ? [cur.note.blocks[0] as Block, ...b] : b,
              )
            }
          />
        }
        onRename={(t) => void saveTitle(cur.id, t)}
        focusTitle={fresh === cur.id}
        onBack={() => setOpen(undefined)}
        onDelete={() => del(cur.id, "Note deleted")}
        collections={collections}
        collectionId={members.get(cur.id) ?? null}
        onMove={(c) => move(cur.id, c)}
        onPin={() =>
          void call("item.pin", { id: cur.id }, readToken()).then((r) => {
            if (!r.ok) setStartError(r.reason);
          })
        }
        onStartSession={() => void startSession()}
      />
    </>
  );
}
