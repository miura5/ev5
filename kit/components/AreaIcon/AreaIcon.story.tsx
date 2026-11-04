import { AreaIcon } from './AreaIcon';

const NAMES = ['today', 'ask', 'library', 'notes', 'progress', 'activity', 'deleted', 'other'];

export function Story() {
  return (
    <div data-ui="story-area-icon" style={{ display: 'flex', gap: 'var(--sp-4)' }}>
      {NAMES.map((n) => (
        <AreaIcon key={n} name={n} />
      ))}
    </div>
  );
}
