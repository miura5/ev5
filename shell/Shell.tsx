import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Detail,
  Glyph,
  AreaIcon,
  JobLine,
  NavGroup,
  NavItem,
  Palette,
  SidebarSearch,
  Workspace,
  type DetailProps,
  type GlyphType,
  type PaletteGroup,
} from '../kit/index.ts';
import { call, paletteEntries, type PaletteEntry } from '../commands/client.ts';
import { Ev4Offer } from './Ev4Offer.tsx';
import { SavedCopyNotice } from './SavedCopyNotice.tsx';
import { storedToken } from './outbox/index.ts';
import type { Services } from './services.ts';
import { AREAS, areaFor, sidebarAreas, type AreaEntry } from './areas.ts';
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
  /** Forget the saved token and show the token screen; the control is hidden when absent. */
  onUseDifferentToken?: () => void;
}

export const DELETED_ROUTE = '/deleted';

/** Commands the palette leaves to Places and the Tab hand-off, which already do them. */
const PLACE_COMMANDS = new Set(['nav.go', 'ask.send']);

/** The registry's palette entries for the area Matt is in (§ui.palette); absent `places` means everywhere. */
export const commandsFor = (areaId: string | undefined, entries: readonly PaletteEntry[] = paletteEntries) =>
  entries.filter((e) => !PLACE_COMMANDS.has(e.name) && (!e.places || (areaId && e.places.includes(areaId))));

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
  onUseDifferentToken,
}: ShellProps) {
  const [palette, setPalette] = useState(false);
  const bare = path.split('?')[0] ?? path;
  const current = areaFor(bare, areas);
  // ⌘J flips between Ask E.V. and wherever Matt was; the latest values are read through a ref.
  const live = useRef({ path, current, areas, onNavigate });
  live.current = { path, current, areas, onNavigate };
  const back = useRef('/');
  useEffect(() => {
    if (current?.id !== 'ask') back.current = path;
  }, [current, path]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      const k = e.key.toLowerCase();
      if (k === 'k') {
        e.preventDefault();
        setPalette((open) => !open);
      } else if (k === 'j') {
        e.preventDefault();
        const l = live.current;
        const ask = l.areas.find((x) => x.id === 'ask');
        if (l.current?.id === 'ask') l.onNavigate(back.current);
        else if (ask) l.onNavigate(ask.route);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  const View = current?.view;
  const groups = useMemo<PaletteGroup[]>(
    () => [
      {
        name: 'Places',
        items: sidebarAreas(areas).map((a) => ({ key: `area:${a.id}`, label: a.nav })),
      },
      {
        name: 'Commands',
        items: commandsFor(current?.id).map((e) => ({ key: `cmd:${e.name}`, label: e.title })),
      },
      {
        name: 'Pinned',
        items: pins.map((p) => ({
          key: `pin:${p.id}`,
          label: p.title,
          glyph: <Glyph type={p.type} />,
        })),
      },
    ].filter((g) => g.items.length > 0),
    [areas, pins, current?.id],
  );
  const run = (key: string) => {
    setPalette(false);
    const [kind, id = ''] = [key.slice(0, key.indexOf(':')), key.slice(key.indexOf(':') + 1)];
    if (kind === 'area') {
      const a = areas.find((x) => x.id === id);
      if (a) onNavigate(a.route);
    } else if (kind === 'pin') onOpenPin?.(id);
    else if (kind === 'cmd') void call(id as Parameters<typeof call>[0], {}, storedToken());
  };
  // Tab: the typed request goes to Ask E.V. as ?text= for it to pick up.
  const ask = (text: string) => {
    setPalette(false);
    const a = areas.find((x) => x.id === 'ask');
    if (a) onNavigate(text ? `${a.route}?text=${encodeURIComponent(text)}` : a.route);
  };
  return (
    <div className="shell" data-ui="shell">
      <nav className="shell-side" aria-label="Primary">
        <Workspace />
        <SidebarSearch onOpen={() => setPalette(true)} />
        {sidebarAreas(areas).map((a) => (
          <NavItem
            key={a.id}
            label={a.nav}
            icon={<AreaIcon name={a.id} />}
            count={counts[a.id]}
            selected={bare !== DELETED_ROUTE && a === current}
            onOpen={() => onNavigate(a.route)}
          />
        ))}
        {pins.length > 0 ? <NavGroup label="Pinned" /> : null}
        {pins.map((p) => (
          <NavItem key={p.id} label={p.title} icon={<Glyph type={p.type} />} onOpen={() => onOpenPin?.(p.id)} />
        ))}
        <div className="shell-grow" />
        {runningJob ? <JobLine text={runningJob.text} onOpen={() => onOpenJob?.(runningJob.id)} /> : null}
        {onUseDifferentToken ? <NavItem label="Use a different token" onOpen={onUseDifferentToken} /> : null}
        <NavItem
          label="Recently deleted"
          icon={<AreaIcon name="deleted" />}
          count={deletedCount}
          selected={bare === DELETED_ROUTE}
          onOpen={() => onNavigate(DELETED_ROUTE)}
        />
      </nav>
      <main className="shell-main">
        <div className="shell-col">
          <Ev4Offer ev4={services?.ev4} />
          <SavedCopyNotice copy={services?.readCopy} />
          {View ? <View services={services} onNavigate={onNavigate} path={bare} /> : null}
        </div>
      </main>
      {detail ? <Detail {...detail} /> : null}
      {palette ? <Palette groups={groups} onRun={run} onAsk={ask} onClose={() => setPalette(false)} /> : null}
    </div>
  );
}
