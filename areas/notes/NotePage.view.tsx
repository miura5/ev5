import type { ReactNode } from "react";
import { Button } from "../../kit/index.ts";
import { RowActions } from "./parts/RowActions.tsx";
import { NoteBlocks } from "./parts/NoteBlocks.tsx";
import type {
  NoteCollection,
  NotePageData,
  NoteSessionState,
} from "./types.ts";
import "./notes.css";

export type { NotePageData, NoteSessionState } from "./types.ts";

export interface NotePageProps {
  note: NotePageData;
  /** Replaces the read-only blocks while the note is being edited. */
  editor?: ReactNode;
  /** Present only while a study session runs. */
  session?: NoteSessionState;
  onBack?: () => void;
  /** Delete this note (it goes to Recently deleted; the screen offers Undo). */
  onDelete?: () => void;
  /** The Move picker's targets, the note's collection, and the picks of the note menu. */
  collections?: readonly NoteCollection[];
  collectionId?: string | null;
  onMove?: (collectionId: string) => void;
  onPin?: () => void;
  onPickCollection?: () => void;
  onMakeCards?: () => void;
  onStartSession?: () => void;
  onTogglePause?: () => void;
  onEndSession?: () => void;
}

/** One note, one centred page; the session bar shows only while a session runs. */
export function NotePageView({
  note,
  editor,
  session,
  onBack,
  onDelete,
  collections,
  collectionId,
  onMove,
  onPin,
  onPickCollection,
  onMakeCards,
  onStartSession,
  onTogglePause,
  onEndSession,
}: NotePageProps) {
  return (
    <section className="ev-notes" aria-label="Note" data-area="note">
      {session ? (
        <div className="ev-notes-session" data-ui="note-session">
          <i
            className="ev-notes-dot"
            data-state={session.paused ? "paused" : "running"}
          />
          <span>Session {session.timer}</span>
          {session.readAlong ? (
            <span className="ev-notes-meta">read-along on</span>
          ) : null}
          <span className="ev-notes-grow" />
          <Button kind="text" hint="Space" onClick={onTogglePause}>
            {session.paused ? "Resume" : "Pause"}
          </Button>
          <Button kind="secondary" onClick={onEndSession}>
            End
          </Button>
        </div>
      ) : null}
      <div className="ev-notes-pagecol">
        {session ? null : (
          <Button kind="text" onClick={onBack}>
            ← Notes
          </Button>
        )}
        <RowActions
          className="ev-notes-docmeta"
          title={note.title}
          targets={collections}
          current={collectionId}
          onMove={session ? undefined : onMove}
          onAction={
            session
              ? undefined
              : (a) => {
                  if (a === "pin") onPin?.();
                  if (a === "delete") onDelete?.();
                }
          }
        >
          <Button kind="text" onClick={onPickCollection}>
            {note.collectionName ?? "no collection"}
          </Button>
          <span>edited {note.edited}</span>
          <span className="ev-notes-save" data-state={note.saveState}>
            <i className="ev-notes-dot" />
            {note.saveState}
          </span>
          <span className="ev-notes-grow" />
          <Button kind="text" onClick={onMakeCards}>
            Make cards
          </Button>
          {session || !onDelete ? null : (
            <Button kind="text" onClick={onDelete}>
              Delete
            </Button>
          )}
          {session ? null : (
            <Button kind="text" onClick={onStartSession}>
              Start session
            </Button>
          )}
        </RowActions>
        {note.body[0]?.type === "h1" ? null : (
          <h1 className="ev-notes-doctitle">{note.title}</h1>
        )}
        {editor ?? <NoteBlocks body={note.body} />}
      </div>
    </section>
  );
}
