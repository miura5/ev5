import { AreaIcon } from '../AreaIcon/AreaIcon';
import { NavItem } from './NavItem';

export function Story() {
  return (
    <div data-ui="story-nav-item" style={{ width: 'var(--side-w)' }}>
      <NavItem label="Today" icon={<AreaIcon name="today" />} count={4} selected onOpen={() => undefined} />
      <NavItem label="Ask E.V." icon={<AreaIcon name="ask" />} onOpen={() => undefined} />
      <NavItem label="Activity" icon={<AreaIcon name="activity" />} count={2} onOpen={() => undefined} />
      <NavItem label="Spanish" count="Thu" onOpen={() => undefined} />
      <div data-focus-shown style={{ display: 'contents' }}>
        <NavItem label="Focused" onOpen={() => undefined} />
      </div>
    </div>
  );
}
