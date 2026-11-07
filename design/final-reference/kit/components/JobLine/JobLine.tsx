import { Dot } from '../Dot/Dot';

export interface JobLineProps {
  /** What is running, in plain words, such as "Writing practice set". The pulsing dot names the step for assistive tech. */
  text: string;
  /** The step in hand and the number of steps. */
  step: { at: number; of: number };
  onOpen?: () => void;
}

/** The running job as one quiet line, led by the kit Dot with pulse (the mark never shows work), at the foot of the sidebar; it opens the job in Activity and announces step changes. */
export function JobLine({ text, step, onOpen }: JobLineProps) {
  return (
    <button
      type="button"
      className="kit-jobline"
      data-ui="job-line"
      title={`Step ${step.at} of ${step.of} · open in Activity`}
      aria-live="polite"
      onClick={onOpen}
    >
      <Dot tone="faint" pulse label={`Step ${step.at} of ${step.of}`} />
      <span className="kit-jobline-text">{text}</span>
    </button>
  );
}
