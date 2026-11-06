import { JobLine } from './JobLine';

export function Story() {
  return (
    <div data-ui="story-job-line" style={{ width: 'var(--side-w)' }}>
      <JobLine text="Writing practice set · 3/4" onOpen={() => undefined} />
    </div>
  );
}
