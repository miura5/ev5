import type { Theme } from '../../index';

export interface ThemeButtonProps {
  /** The theme showing now; the button offers the other one. */
  theme: Theme;
  onToggle?: () => void;
  /** The shortcut shown beside the label. */
  hint?: string;
}

/** The sidebar foot's theme button: names the theme it will switch to, with its key. */
export function ThemeButton({ theme, onToggle, hint = '\\' }: ThemeButtonProps) {
  return (
    <button type="button" className="kit-themebtn" data-ui="theme-button" title="Switch theme" onClick={onToggle}>
      <span>{theme === 'dark' ? 'Light theme' : 'Dark theme'}</span>
      <span className="kit-themebtn-kbd">{hint}</span>
    </button>
  );
}
