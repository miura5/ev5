import { useEffect, useRef, type ReactNode } from "react";
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

/** The note's title, edited in place: Enter or leaving saves, Esc puts the old words back. */
function TitleField({
  title,
  focus,
  onRename,
}: {
  title: string;
  focus?: boolean;
  onRename: (title: string) => void;
}) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!focus || !el) return;
    el.focus();
    getSelection()?.selectAllChildren(el);
  }, [focus]);
  return (
    <h1
      ref={ref}
      className="ev-notes-doctitle"
      data-ui="note-title"
      role="textbox"
      aria-label="Title"
      tabIndex={0}
      contentEditable
      suppressContentEditableWarning
      data-placeholder="Untitled"
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          e.currentTarget.blur();
        } else if (e.key === "Escape") {
          e.currentTarget.textContent = title;
          e.currentTarget.blur();
        }
      }}
      onBlur={(e) => {
        const t = (e.currentTarget.textContent ?? "")
          .replace(/\s+/g, " ")
          .trim();
        if (!t) e.currentTarget.textContent = title;
        else if (t !== title) onRename(t);
      }}
    >
      {title}
    </h1>
  );
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
        </RowActions>
        {onRename ? (
          <TitleField
            title={note.title}
            focus={focusTitle}
            onRename={onRename}
          />
        ) : note.body[0]?.type === "h1" ? null : (
          <h1 className="ev-notes-doctitle">{note.title}</h1>
        )}
        {editor ?? <NoteBlocks body={note.body} />}
      </div>
    </section>
  );
}
