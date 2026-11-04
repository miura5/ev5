import { Glyph } from '../Glyph/Glyph';

export interface JobLineProps {
  /** What is running, in plain words, such as "Writing mock exam · 3/4". */
  text: string;
  onOpen?: () => void;
}

/** The running job as one quiet line at the foot of the sidebar; it opens the job in Activity. */
export function JobLine({ text, onOpen }: JobLineProps) {
  return (
    <button type="button" className="kit-jobline" data-ui="job-line" title="Open in Activity" onClick={onOpen}>
      <Glyph type="job" running />
      <span className="kit-jobline-text">{text}</span>
    </button>
  );
}
