export interface SidebarSearchProps {
  onOpen?: () => void;
  /** The shortcut shown beside the label. */
  hint?: string;
}

/** The sidebar's "Search or ask" field: a button that opens ⌘K. */
export function SidebarSearch({ onOpen, hint = '⌘K' }: SidebarSearchProps) {
  return (
    <button type="button" className="kit-sidesearch" data-ui="sidebar-search" onClick={onOpen}>
      <span>Search or ask</span>
      <span className="kit-sidesearch-kbd">{hint}</span>
    </button>
  );
}
