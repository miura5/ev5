import type { ReactNode } from 'react';
import type { NoteBlock, NoteBody, NoteRun } from '../types.ts';

function Runs({ runs }: { runs: readonly NoteRun[] }) {
  return (
    <>
      {runs.map((r, k) => {
        let n: ReactNode = r.text;
        if (r.b) n = <b>{n}</b>;
        if (r.i) n = <i>{n}</i>;
        if (r.u) n = <u>{n}</u>;
        if (r.s) n = <s>{n}</s>;
        if (r.href) n = <a href={r.href}>{n}</a>;
        return <span key={k}>{n}</span>;
      })}
    </>
  );
}

function Block({ b }: { b: NoteBlock }) {
  switch (b.type) {
    case 'h1':
      return (
        <h2 className="ev-notes-h1" data-block="h1">
          <Runs runs={b.runs} />
        </h2>
      );
    case 'h2':
      return (
        <h3 data-block="h2">
          <Runs runs={b.runs} />
        </h3>
      );
    case 'h3':
      return (
        <h4 data-block="h3">
          <Runs runs={b.runs} />
        </h4>
      );
    case 'p':
      return (
        <p data-block="p">
          <Runs runs={b.runs} />
        </p>
      );
    case 'img':
      return (
        <figure className="ev-notes-pic" data-block="img">
          <span>{b.alt ? `Image · ${b.alt}` : 'Image'}</span>
        </figure>
      );
    case 'todo':
      return (
        <div
          className="ev-notes-li"
          data-block="todo"
          data-done={b.checked ? 'true' : 'false'}
          style={{ paddingLeft: `calc(var(--sp-6) * ${b.indent ?? 0})` }}
        >
          <input type="checkbox" checked={!!b.checked} readOnly aria-label="Done" />
          <span>
            <Runs runs={b.runs} />
          </span>
        </div>
      );
    default:
      return (
        <div
          className="ev-notes-li"
          data-block={b.type}
          style={{ paddingLeft: `calc(var(--sp-6) * ${b.indent ?? 0})` }}
        >
          <span aria-hidden="true">{b.type === 'ul' ? '•' : '–'}</span>
          <span>
            <Runs runs={b.runs} />
          </span>
        </div>
      );
  }
}

/** The note's blocks as the page shows them; a two-column row puts a picture beside its text. */
export function NoteBlocks({ body }: { body: readonly NoteBody[] }) {
  return (
    <div className="ev-notes-doc" data-ui="note-body">
      {body.map((b, k) =>
        b.type === 'row' ? (
          <div className="ev-notes-cols" data-block="row" key={b.id}>
            <div className="ev-notes-col">
              {b.left.map((c, j) => (
                <Block b={c} key={j} />
              ))}
            </div>
            <div className="ev-notes-col">
              {b.right.map((c, j) => (
                <Block b={c} key={j} />
              ))}
            </div>
          </div>
        ) : (
          <Block b={b} key={k} />
        ),
      )}
    </div>
  );
}
