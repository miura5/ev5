import type { ComponentType } from "react";
import { areas } from "../areas/registry.generated.ts";

/** What the shell reads from each area's `area.ts`: its route, sidebar label and the view it mounts. */
export interface AreaEntry {
  readonly id: string;
  readonly route: string;
  readonly nav: string;
  readonly view: ComponentType;
}

/** Every area, in registry order: the sidebar, the router and ⌘K's Places all read this one list. */
export const AREAS: readonly AreaEntry[] = areas;

/** The area whose route is `path`; the first area when none matches. */
export function areaFor(
  path: string,
  list: readonly AreaEntry[] = AREAS,
): AreaEntry | undefined {
  return list.find((a) => a.route === path) ?? list[0];
}
