import { JobLine } from './JobLine';

export function Story() {
  return (
    <div data-ui="story-job-line" style={{ width: 'var(--side-w)' }}>
      <JobLine text="Writing practice set" step={{ at: 3, of: 4 }} onOpen={() => undefined} />
    </div>
  );
}
