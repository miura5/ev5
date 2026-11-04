import { NavGroup } from './NavGroup';

export function Story() {
  return (
    <div data-ui="story-nav-group" style={{ width: 'var(--side-w)' }}>
      <NavGroup label="Pinned" />
    </div>
  );
}
