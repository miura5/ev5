import { Button } from "../../kit/index.ts";
import { NoteBlocks } from "./parts/NoteBlocks.tsx";
import type { NotePageData, NoteSessionState } from "./types.ts";
import "./notes.css";

export type { NotePageData, NoteSessionState } from "./types.ts";

export interface NotePageProps {
  note: NotePageData;
  /** Present only while a study session runs. */
  session?: NoteSessionState;
  onBack?: () => void;
  onPickCollection?: () => void;
  onMakeCards?: () => void;
  onStartSession?: () => void;
  onTogglePause?: () => void;
  onEndSession?: () => void;
}

/** One note, one centred page; the session bar shows only while a session runs. */
export function NotePageView({
  note,
  session,
  onBack,
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
          <button type="button" className="ev-notes-crumb" onClick={onBack}>
            ← Notes
          </button>
        )}
        <div className="ev-notes-docmeta">
          <button
            type="button"
            className="ev-notes-pick"
            onClick={onPickCollection}
          >
            {note.collectionName ?? "no collection"}
          </button>
          <span>edited {note.edited}</span>
          <span className="ev-notes-save" data-state={note.saveState}>
            <i className="ev-notes-dot" />
            {note.saveState}
          </span>
          <span className="ev-notes-grow" />
          <Button kind="text" onClick={onMakeCards}>
            Make cards
          </Button>
          {session ? null : (
            <Button kind="text" onClick={onStartSession}>
              Start session
            </Button>
          )}
        </div>
        <h1 className="ev-notes-doctitle">{note.title}</h1>
        <NoteBlocks body={note.body} />
      </div>
    </section>
  );
}
