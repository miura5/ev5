const PATHS: Record<string, string> = {
  today: 'M8 2.25a5.75 5.75 0 1 0 0 11.5 5.75 5.75 0 0 0 0-11.5zM8 5v3l2 1.5',
  ask: 'M2.5 3.5h11v7h-6l-3 2.5v-2.5h-2z',
  library: 'M3 2.5h3v11H3zM7.5 2.5h3v11h-3zM11.5 3l2.5.6-2 10-2.5-.6',
  notes: 'M4 2.5h6l2.5 2.5v8.5H4zM6 8h4.5M6 10.5h3',
  progress: 'M3 13V8M8 13V3M13 13v-6',
  activity: 'M2 8h3l2-4 2 8 2-4h3',
  deleted: 'M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.6 8.5h5.8l.6-8.5',
};
const FALLBACK = 'M8 2.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11z';

/** The sidebar's line icon for an area (today, ask, library, notes, progress, activity, deleted); a ring for any other. */
export function AreaIcon({ name }: { name: string }) {
  return (
    <svg className="kit-areaicon" data-ui="area-icon" viewBox="0 0 16 16" aria-hidden="true">
      <path d={PATHS[name] ?? FALLBACK} />
    </svg>
  );
}
