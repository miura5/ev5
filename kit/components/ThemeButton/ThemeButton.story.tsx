import { ThemeButton } from './ThemeButton';

export function Story() {
  return (
    <div data-ui="story-theme-button" style={{ width: 'var(--side-w)' }}>
      <ThemeButton theme="dark" onToggle={() => undefined} />
      <ThemeButton theme="light" onToggle={() => undefined} />
    </div>
  );
}
