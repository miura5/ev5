import { useEffect, useMemo, useRef, useState } from "react";
import {
  Detail,
  Glyph,
  AreaIcon,
  JobLine,
  NavGroup,
  NavItem,
  Palette,
  SidebarSearch,
  WorkspaceLine,
  ThemeButton,
  type DetailProps,
  type GlyphType,
  type PaletteGroup,
} from "../kit/index.ts";
import { call } from "../commands/client.ts";
import {
  FOUND,
  findInRecord,
  readDeletedKeys,
  type Record_,
} from "./findings.ts";
import { SavedCopyNotice } from "./SavedCopyNotice.tsx";
import { storedToken } from "./outbox/index.ts";
import type { Services } from "./services.ts";
import { AREAS, areaFor, sidebarAreas, type AreaEntry } from "./areas.ts";
import { commandsFor } from "./commandsFor.ts";
import { useTheme } from "./theme.ts";
import { DetailSlot } from "./DetailSlot.tsx";
import { useOpenedDetail } from "./useOpenedDetail.ts";
import { ToastHost } from "./ToastHost.tsx";
import { useToasts } from "./useToasts.ts";
import "./shell.css";

export interface Pin {
  id: string;
  title: string;
  type: GlyphType;
  when?: string; // the day of a pinned collection's next linked date
}

export interface ShellProps {
  path: string;
  onNavigate: (path: string) => void;
  areas?: readonly AreaEntry[];
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

export const DELETED_ROUTE = "/deleted";

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
  const [theme, toggleTheme] = useTheme();
  const bare = path.split("?")[0] ?? path;
  const current = areaFor(bare, areas);
  // ⌘J flips between Ask E.V. and wherever Matt was; the latest values are read through a ref.
  const live = useRef({ path, current, areas, onNavigate, toggleTheme });
  live.current = { path, current, areas, onNavigate, toggleTheme };
  const back = useRef("/");
  useEffect(() => {
    if (current?.id !== "ask") back.current = path;
  }, [current, path]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const typing =
        !!t &&
        (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
      if (e.key === "\\" && !e.metaKey && !e.ctrlKey && !e.altKey && !typing) {
        e.preventDefault();
        return live.current.toggleTheme();
      }
      if (!(e.metaKey || e.ctrlKey)) return;
      const k = e.key.toLowerCase();
      if (k === "k") {
        e.preventDefault();
        setPalette((open) => !open);
      } else if (k === "j") {
        e.preventDefault();
        const l = live.current;
        const ask = l.areas.find((x) => x.id === "ask");
        if (l.current?.id === "ask") l.onNavigate(back.current);
        else if (ask) l.onNavigate(ask.route);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const View = current?.view;
  const od = useOpenedDetail(path, palette, onNavigate);
  const { toasts, show: showToast, drop: dropToast } = useToasts(services);
  // What Matt types in ⌘K comes from the palette's onQuery; the record is read once each time the palette opens.
  const [typed, setTyped] = useState("");
  const [record, setRecord] = useState<Record_>({});
  useEffect(() => {
    if (!palette) {
      setTyped("");
      return;
    }
    let live = true;
    const rows = services?.rows;
    if (rows)
      void Promise.all([
        readDeletedKeys(),
        ...FOUND.map(
          async (f) =>
            [
              f.collection,
              await rows.list(f.collection).catch(() => []),
            ] as const,
        ),
      ]).then(([gone, ...all]) => {
        if (live)
          setRecord(
            Object.fromEntries(
              all.map(([c, rows]) => [
                c,
                rows.filter((r) => !gone.has(`${c}/${r.id}`)),
              ]),
            ),
          );
      });
    return () => {
      live = false;
    };
  }, [palette, services]);
  const found = useMemo<PaletteGroup[]>(() => {
    const hits = findInRecord(record, typed);
    return FOUND.map((f) => ({
      name: f.group,
      items: hits
        .filter((h) => h.collection === f.collection)
        .map((h) => ({ key: `found:${h.collection}:${h.id}`, label: h.title })),
    }));
  }, [record, typed]);
  const groups = useMemo<PaletteGroup[]>(
    () =>
      [
        ...found,
        {
          name: "Places",
          items: sidebarAreas(areas).map((a) => ({
            key: `area:${a.id}`,
            label: a.nav,
          })),
        },
        {
          name: "Commands",
          items: commandsFor(current?.id).map((e) => ({
            key: `cmd:${e.name}`,
            label: e.title,
          })),
        },
        {
          name: "Pinned",
          items: pins.map((p) => ({
            key: `pin:${p.id}`,
            label: p.title,
            glyph: <Glyph type={p.type} />,
          })),
        },
      ].filter((g) => g.items.length > 0),
    [found, areas, pins, current?.id],
  );
  const run = (key: string) => {
    setPalette(false);
    const [kind, id = ""] = [
      key.slice(0, key.indexOf(":")),
      key.slice(key.indexOf(":") + 1),
    ];
    if (kind === "area") {
      const a = areas.find((x) => x.id === id);
      if (a) onNavigate(a.route);
    } else if (kind === "found") {
      // The area that holds the item opens it by id (?open=), so the address names the item.
      const [collection = "", docId = ""] = [
        id.slice(0, id.indexOf(":")),
        id.slice(id.indexOf(":") + 1),
      ];
      const area = FOUND.find((f) => f.collection === collection)?.area;
      const a = areas.find((x) => x.id === area);
      if (a) onNavigate(`${a.route}?open=${encodeURIComponent(docId)}`);
    } else if (kind === "pin") onOpenPin?.(id);
    else if (kind === "cmd" && id === "theme.toggle") toggleTheme();
    else if (kind === "cmd" && id === "notes.shortcuts")
      window.dispatchEvent(new Event("ev5:note-shortcuts"));
    else if (kind === "cmd")
      void call(id as Parameters<typeof call>[0], {}, storedToken());
  };
  // Tab: the typed request goes to Ask E.V. as ?text= for it to pick up.
  const ask = (text: string) => {
    setPalette(false);
    const a = areas.find((x) => x.id === "ask");
    if (a)
      onNavigate(
        text ? `${a.route}?text=${encodeURIComponent(text)}` : a.route,
      );
  };
  return (
    <div className="shell" data-ui="shell">
      <nav className="shell-side" aria-label="Primary">
        <WorkspaceLine />
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
          <NavItem
            key={p.id}
            label={p.title}
            icon={<Glyph type={p.type} />}
            count={p.when}
            onOpen={() => onOpenPin?.(p.id)}
          />
        ))}
        <div className="shell-grow" />
        {runningJob ? (
          <JobLine
            text={runningJob.text}
            onOpen={() => onOpenJob?.(runningJob.id)}
          />
        ) : null}
        {onUseDifferentToken ? (
          <NavItem label="Use a different token" onOpen={onUseDifferentToken} />
        ) : null}
        <ThemeButton theme={theme} onToggle={toggleTheme} />
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
          <SavedCopyNotice copy={services?.readCopy} />
          {View ? (
            <View
              services={services}
              onNavigate={onNavigate}
              path={bare}
              search={path.split("?").slice(1).join("?")}
              onDetail={od[1]}
              onToast={showToast}
            />
          ) : null}
        </div>
      </main>
      <DetailSlot opened={od[0]} onClear={od[2]} legacy={detail} />
      <ToastHost toasts={toasts} onDrop={dropToast} hidden={palette} />
      {palette ? (
        <Palette
          groups={groups}
          onRun={run}
          onAsk={ask}
          onClose={() => setPalette(false)}
          onQuery={setTyped}
        />
      ) : null}
    </div>
  );
}
