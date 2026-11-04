import { useEffect, useMemo, useState } from 'react';
import {
  Detail,
  Glyph,
  AreaIcon,
  JobLine,
  NavGroup,
  NavItem,
  Palette,
  SidebarSearch,
  type DetailProps,
  type GlyphType,
  type PaletteGroup,
} from '../kit/index.ts';
import { Ev4Offer } from './Ev4Offer.tsx';
import type { Services } from './services.ts';
import { AREAS, areaFor, type AreaEntry } from './areas.ts';
import './shell.css';

export interface Pin {
  id: string;
  title: string;
  type: GlyphType;
}

export interface ShellProps {
  path: string;
  onNavigate: (path: string) => void;
  areas?: readonly AreaEntry[];
  /** Matt's pins, in his order; anything he chose to keep in the sidebar. */
  pins?: readonly Pin[];
  onOpenPin?: (id: string) => void;
  /** Items in Recently deleted; the entry shows it as its one value. */
  deletedCount?: number;
  /** Counts shown beside areas, by area id (Today's open items, Activity's needs-you). */
  counts?: Readonly<Record<string, number>>;
  /** The running job as one quiet line at the foot of the sidebar; absent when none runs. */
  runningJob?: { id: string; text: string };
  onOpenJob?: (id: string) => void;
  /** The open item's Detail panel; absent when none is open. */
  detail?: DetailProps | null;
  /** Reads and the outbox, handed to every area view. */
  services?: Services;
}

export const DELETED_ROUTE = '/deleted';

/** The frame: sidebar (areas, Pinned, Recently deleted), one centred column, Detail on demand, and ⌘K. */
export function Shell({
  path,
  onNavigate,
  areas = AREAS,
  pins = [],
  onOpenPin,
  deletedCount,
  counts = {},
  runningJob,
  onOpenJob,
  detail,
  services,
}: ShellProps) {
  const [palette, setPalette] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPalette((open) => !open);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  const current = areaFor(path, areas);
  const View = path === DELETED_ROUTE ? undefined : current?.view;
  const groups = useMemo<PaletteGroup[]>(
    () => [
      {
        name: 'Places',
        items: areas.map((a) => ({ key: `area:${a.id}`, label: a.nav })),
      },
      {
        name: 'Pinned',
        items: pins.map((p) => ({
          key: `pin:${p.id}`,
          label: p.title,
          glyph: <Glyph type={p.type} />,
        })),
      },
    ],
    [areas, pins],
  );
  const run = (key: string) => {
    setPalette(false);
    const [kind, id = ''] = [key.slice(0, key.indexOf(':')), key.slice(key.indexOf(':') + 1)];
    if (kind === 'area') {
      const a = areas.find((x) => x.id === id);
      if (a) onNavigate(a.route);
    } else if (kind === 'pin') onOpenPin?.(id);
  };
  const ask = () => {
    setPalette(false);
    const a = areas.find((x) => x.id === 'ask');
    if (a) onNavigate(a.route);
  };
  return (
    <div className="shell" data-ui="shell">
      <nav className="shell-side" aria-label="Primary">
        <SidebarSearch onOpen={() => setPalette(true)} />
        {areas.map((a) => (
          <NavItem
            key={a.id}
            label={a.nav}
            icon={<AreaIcon name={a.id} />}
            count={counts[a.id]}
            selected={path !== DELETED_ROUTE && a === current}
            onOpen={() => onNavigate(a.route)}
          />
        ))}
        {pins.length > 0 ? <NavGroup label="Pinned" /> : null}
        {pins.map((p) => (
          <NavItem key={p.id} label={p.title} icon={<Glyph type={p.type} />} onOpen={() => onOpenPin?.(p.id)} />
        ))}
        <div className="shell-grow" />
        {runningJob ? <JobLine text={runningJob.text} onOpen={() => onOpenJob?.(runningJob.id)} /> : null}
        <NavItem
          label="Recently deleted"
          icon={<AreaIcon name="deleted" />}
          count={deletedCount}
          selected={path === DELETED_ROUTE}
          onOpen={() => onNavigate(DELETED_ROUTE)}
        />
      </nav>
      <main className="shell-main">
        <div className="shell-col">
          <Ev4Offer ev4={services?.ev4} />
          {View ? <View services={services} /> : null}
        </div>
      </main>
      {detail ? <Detail {...detail} /> : null}
      {palette ? <Palette groups={groups} onRun={run} onAsk={ask} onClose={() => setPalette(false)} /> : null}
    </div>
  );
}
