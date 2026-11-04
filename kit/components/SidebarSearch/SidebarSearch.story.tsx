import { SidebarSearch } from './SidebarSearch';

export function Story() {
  return (
    <div data-ui="story-sidebar-search" style={{ width: 'var(--side-w)' }}>
      <SidebarSearch onOpen={() => undefined} />
    </div>
  );
}
