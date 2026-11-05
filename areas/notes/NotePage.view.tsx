import type { ReactNode } from "react";
import { Button, Dot, Page } from "../../kit/index.ts";
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
  /** Present: the title is a field Matt types in; Enter or leaving it saves, Esc cancels. */
  onRename?: (title: string) => void;
  /** A note just made: its title is selected and ready to type. */
  focusTitle?: boolean;
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
  /** Opens the list of the editor's keys. */
  onShortcuts?: () => void;
}

/** One note, one centred page; the session bar shows only while a session runs. */
export function NotePageView({
  note,
  editor,
  session,
  onBack,
  onRename,
  focusTitle,
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
  onShortcuts,
}: NotePageProps) {
  const tone =
    note.saveState === "saved"
      ? "ok"
      : note.saveState === "saving"
        ? "info"
        : "warn";
  const body =
    !onRename && note.body[0]?.type === "h1" ? note.body.slice(1) : note.body;
  return (
    <section className="ev-notes" aria-label="Note" data-area="note">
      {session ? (
        <div className="ev-notes-session" data-ui="note-session">
          <Dot tone={session.paused ? "faint" : "info"} />
          <span>Session {session.timer}</span>
          {session.readAlong ? <span>read-along on</span> : null}
          <span className="ev-notes-end">
            <Button kind="text" hint="Space" onClick={onTogglePause}>
              {session.paused ? "Resume" : "Pause"}
            </Button>
            <Button kind="secondary" onClick={onEndSession}>
              End
            </Button>
          </span>
        </div>
      ) : null}
      <RowActions
        className="ev-notes-host"
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
        <Page
          title={note.title}
          onTitle={onRename}
          titlePlaceholder="Untitled"
          focusTitle={focusTitle}
          meta={`edited ${note.edited}`}
          crumb={
            session ? undefined : (
              <Button kind="text" onClick={onBack}>
                ← Notes
              </Button>
            )
          }
          actions={
            <>
              <Button kind="text" onClick={onPickCollection}>
                {note.collectionName ?? "no collection"}
              </Button>
              <Dot tone={tone} label={note.saveState} />
              {session || !onShortcuts ? null : (
                <Button
                  kind="text"
                  title="The keys the note editor understands"
                  onClick={onShortcuts}
                >
                  Shortcuts
                </Button>
              )}
              <Button
                kind="text"
                title="Start a set from this note; E.V. drafts, you keep or drop"
                onClick={onMakeCards}
              >
                Make cards
              </Button>
              {session || !onDelete ? null : (
                <Button kind="text" onClick={onDelete}>
                  Delete
                </Button>
              )}
              {session ? null : (
                <Button
                  kind="text"
                  title="Start a study session"
                  onClick={onStartSession}
                >
                  Start session
                </Button>
              )}
            </>
          }
        />
      </RowActions>
      {editor ?? <NoteBlocks body={body} />}
    </section>
  );
}
