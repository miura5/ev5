/** The quiet label above a group of sidebar items, such as Pinned. */
export function NavGroup({ label }: { label: string }) {
  return (
    <div className="kit-navgroup" data-ui="nav-group">
      {label}
    </div>
  );
}
