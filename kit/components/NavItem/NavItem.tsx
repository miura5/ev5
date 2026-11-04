import type { ReactNode } from 'react';

export interface NavItemProps {
  label: string;
  /** The icon or glyph, drawn by the caller. */
  icon?: ReactNode;
  /** The one quiet value on the right; a count, or a word such as a weekday. */
  count?: string | number;
  selected?: boolean;
  onOpen?: () => void;
}

/** One sidebar line: icon, label, a quiet count. */
export function NavItem({ label, icon, count, selected, onOpen }: NavItemProps) {
  return (
    <button
      type="button"
      className={selected ? 'kit-nav kit-nav-on' : 'kit-nav'}
      data-ui="nav-item"
      aria-current={selected ? 'page' : undefined}
      onClick={onOpen}
    >
      {icon}
      <span className="kit-nav-label">{label}</span>
      {count !== undefined && count !== '' && count !== 0 ? <span className="kit-nav-count">{count}</span> : null}
    </button>
  );
}
