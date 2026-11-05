import type { ReactElement } from "react";
import { Menu, type MenuItem } from "../Menu/Menu";

export interface MoveTarget {
  id: string;
  title: string;
  /** The parent collection; a child is listed directly under it. */
  parentId?: string | null;
}

export interface MovePickerProps {
  /** The collections Move can pick. */
  targets: readonly MoveTarget[];
  /** The collection the item is in now, ticked; null when it is in none. */
  current: string | null;
  /** Called with the picked collection id, or null for "No collection". */
  onMove: (collectionId: string | null) => void;
  label: string;
  trigger: ReactElement;
  /** Adds a first choice that takes the item out of any collection. */
  noneLabel?: string;
}

const NONE = "__none";

/** The picker's items: collections by name, each child under its parent, the current one ticked. */
export function moveItems(
  targets: readonly MoveTarget[],
  current: string | null,
  noneLabel?: string,
): MenuItem[] {
  const ids = new Set(targets.map((t) => t.id));
  const out: MenuItem[] = [];
  if (noneLabel)
    out.push({ key: NONE, label: noneLabel, checked: current === null });
  const seen = new Set<string>();
  const walk = (parent: string | null, depth: 0 | 1) => {
    for (const t of targets) {
      const p = t.parentId && ids.has(t.parentId) ? t.parentId : null;
      if (p !== parent || seen.has(t.id)) continue;
      seen.add(t.id);
      out.push({
        key: t.id,
        label: t.title,
        checked: t.id === current,
        indent: depth,
      });
      walk(t.id, 1);
    }
  };
  walk(null, 0);
  return out;
}

/** Move to a collection: a menu of collections by name with the current one ticked. */
export function MovePicker({
  targets,
  current,
  onMove,
  label,
  trigger,
  noneLabel,
}: MovePickerProps) {
  return (
    <Menu
      label={label}
      trigger={trigger}
      items={moveItems(targets, current, noneLabel)}
      onPick={(k) => {
        const id = k === NONE ? null : k;
        if (id !== current) onMove(id);
      }}
    />
  );
}
