export interface WorkspaceLineProps {
  /** The workspace name beside the mark. */
  name?: string;
}

/** The sidebar's first line: E.V.'s quiet dotted mark and her name. */
export function WorkspaceLine({ name = 'E.V.' }: WorkspaceLineProps) {
  return (
    <div className="kit-workspace" data-ui="workspace-line">
      <span className="kit-workspace-mark" aria-hidden="true" />
      {name}
    </div>
  );
}
