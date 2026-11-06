import type { ComponentType } from "react";
import type { DetailProps } from "../kit/index.ts";
import type { Services } from "./services.ts";
import type { OnToast } from "./useToasts.ts";
import { areas } from "../areas/registry.generated.ts";

/** What a view calls to open or replace the shell's Detail panel, or clear it with null. */
export type OnDetail = (detail: DetailProps | null) => void;

/** What the shell reads from each area's `area.ts`: its route, sidebar label and the view it mounts. */
export interface AreaEntry {
  readonly id: string;
  readonly route: string;
  readonly nav: string;
  /** False for routes the sidebar does not list (collection, sessions, Recently deleted); absent means listed. */
  readonly sidebar?: boolean;
  readonly view: ComponentType<{
    services?: Services;
    onNavigate?: (path: string) => void;
    path?: string;
    /** The address query without its "?"; screens read it here, never from window.location (dependency-cruiser wouter-only-in-shell). */
    search?: string;
    onDetail?: OnDetail;
    onToast?: OnToast;
  }>;
}

/** The sidebar's order (CONTRACT §ui.sidebar); areas not named here follow, in registry order. */
const ORDER = ["today", "ask", "library", "notes", "progress", "activity"];
const rank = (id: string) => {
  const i = ORDER.indexOf(id);
  return i < 0 ? ORDER.length : i;
};

/** Every area in sidebar order: the router and ⌘K's Places read this list, the sidebar its listed part. */
export const AREAS: readonly AreaEntry[] = [...areas].sort(
  (a, b) => rank(a.id) - rank(b.id),
);

/** The areas the sidebar lists, in order. */
export const sidebarAreas = (
  list: readonly AreaEntry[] = AREAS,
): readonly AreaEntry[] => list.filter((a) => a.sidebar !== false);

/** The area whose route is `path` or a parent of it (`/collection/ab` opens `/collection`); the first area when none matches. */
export function areaFor(
  path: string,
  list: readonly AreaEntry[] = AREAS,
): AreaEntry | undefined {
  return (
    list.find((a) => a.route === path) ??
    list.find((a) => path.startsWith(`${a.route}/`)) ??
    list[0]
  );
}
