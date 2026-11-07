import { Mark } from '../Mark/Mark';

export interface WorkspaceLineProps {
  /** The workspace name beside the mark. */
  name?: string;
}

/** The sidebar's first line: E.V.'s mark, standing still, and her name. */
export function WorkspaceLine({ name = 'E.V.' }: WorkspaceLineProps) {
  return (
    <div className="kit-workspace" data-ui="workspace-line">
      <Mark logo />
      {name}
    </div>
  );
}
