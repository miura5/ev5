import { useState, type ReactNode } from "react";

export interface HorizonDay {
  /** How the day is said in full, such as "Today" or "Thu Nov 5". */
  label: string;
  /** How the day is said under a wide bar, such as "Today", "Thu 5" or "6". */
  short?: string;
  /** Cards due that day (reviews and weak spots). Load mode only; dates mode never reads it. */
  due?: number;
  /** A dated goal on that day. `when` is how the rail's line says the day, such as "Thu" or "Nov 9" (dates mode). */
  post?: { title: string; tag: string; when?: string };
}

export interface HorizonProps {
  days: readonly HorizonDay[];
  /** "rail" sits in the sidebar at 192 units; "wide" fills a 672 column with day names and full goal titles. */
  size?: "rail" | "wide";
  /** "load" draws the due bars (the wide chart, after cutover). "dates" is the rail from the Coming up read alone:
   *  a baseline, a tick per day, today's mark and a dot on each dated day. No bars, no card counts. Rail only. */
  show?: "load" | "dates";
  /** True when today's plan had cards and all are done. */
  cleared?: boolean;
  /** Opens the screen that explains the load (Progress). Rail only. */
  onOpen?: () => void;
}

const cardsDue = (n: number) => `${n} card${n === 1 ? "" : "s"} due`;

/** What comes due, day by day, against his dates. Quiet bars, today in text grey, a solid post on each dated goal.
 *  Point at a day, or step with the arrow keys, and the line under it reads that day out. */
export function Horizon({ days, size = "rail", show = "load", cleared = false, onOpen }: HorizonProps) {
  const [sel, setSel] = useState<number | null>(null);
  const dates = show === "dates";
  const wide = size === "wide" && !dates;
  const n = days.length;
  const W = wide ? 672 : 192;
  const H = wide ? 64 : 48;
  const top = wide ? 18 : 0;
  const foot = wide ? 20 : 18;
  const step = W / n;
  const bw = wide ? 16 : 9;
  const max = Math.max(1, ...days.map((d) => d.due ?? 0));
  const said = days.map((d) => `${d.label} ${d.due ?? 0}${d.post ? ` (${d.post.title})` : ""}`).join(", ");
  const railName = (i: number) => (i === 0 ? "Today" : i === 1 ? "Tomorrow" : days[i].label.replace(/ [A-Z][a-z]{2} /, " "));

  let line: ReactNode;
  if (dates) {
    const posts = days.filter((d) => d.post);
    if (sel != null) line = (<><b>{railName(sel)}</b>{` · ${days[sel].post?.title ?? "nothing dated"}`}</>);
    else if (!posts.length) line = "Nothing dated in 14 days";
    else line = posts.slice(0, 2).map((d, k) => (
      <span key={k}>{k ? " · " : ""}<b>{d.post!.tag}</b>{d.post!.when ? ` ${d.post!.when}` : ""}</span>
    ));
  } else if (sel != null) {
    const d = days[sel];
    const name = wide ? d.label : d.label.replace(/ [A-Z][a-z]{2} /, " ");
    line = (<><b>{name}</b>{` · ${cardsDue(d.due ?? 0)}`}{d.post ? ` · ${wide ? d.post.title : d.post.tag}` : ""}</>);
  } else {
    const lead = cleared ? "Done for today" : days[0]?.due ? `${cardsDue(days[0].due ?? 0)} today` : "Nothing due today";
    // The rail names no goal here: its post's tag already does (round 7, no repeats).
    const tail = wide ? " · point at a day to read it" : "";
    line = (<><b>{lead}</b>{tail}</>);
  }

  const step1 = (dir: 1 | -1) => setSel((s) => Math.max(0, Math.min(n - 1, (s ?? (dir === 1 ? -1 : n)) + dir)));

  return (
    <div
      className={wide ? "kit-horizon kit-horizon-wide" : "kit-horizon"}
      data-ui="horizon"
      data-show={show}
      role={onOpen && !wide ? "button" : "group"}
      tabIndex={0}
      aria-label={`Next 14 days${dates ? ", dated items" : ""}${onOpen && !wide ? ". Open Progress" : ""}`}
      onClick={wide ? undefined : onOpen}
      onMouseLeave={() => setSel(null)}
      onBlur={() => setSel(null)}
      onKeyDown={(e) => {
        if (e.key === "Escape" && sel != null) {
          e.preventDefault();
          e.stopPropagation();
          setSel(null);
        } else if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
          e.preventDefault();
          step1(e.key === "ArrowRight" ? 1 : -1);
        } else if (onOpen && !wide && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onOpen();
        }
      }}
    >
      {dates ? (
        <svg viewBox={`0 0 ${W} 16`} role="img" aria-label={`Next ${n} days: ${days.filter((d) => d.post).map((d) => `${d.post!.title}, ${d.label}`).join("; ") || "nothing dated"}.`}>
          <line className="kit-horizon-base" x1={0} x2={W} y1={8} y2={8} />
          {days.map((d, i) => {
            const cx = i * step + step / 2;
            return (
              <g key={`day-${i}`} className={sel === i ? "kit-horizon-day sel" : "kit-horizon-day"} onMouseEnter={() => setSel(i)}>
                <title>{`${d.label}${d.post ? `: ${d.post.title}` : ""}`}</title>
                <rect className="kit-horizon-hit" x={i * step} y={0} width={step} height={16} />
                {i === 0 ? (
                  <line className="kit-horizon-now" x1={cx} x2={cx} y1={3} y2={13} />
                ) : (
                  <line className={i % 7 === 0 ? "kit-horizon-mark wk" : "kit-horizon-mark"} x1={cx} x2={cx} y1={6.5} y2={9.5} />
                )}
                {d.post ? <circle className="kit-horizon-dot" cx={cx} cy={8} r={3.5} /> : null}
                <circle className="kit-horizon-ring" cx={cx} cy={8} r={6} />
              </g>
            );
          })}
        </svg>
      ) : (
      <svg viewBox={`0 0 ${W} ${top + H + foot}`} role="img" aria-label={`Cards due in the next ${n} days: ${said}`}>
        {days.map((d, i) => {
          if (!d.post) return null;
          const cx = i * step + step / 2;
          /* A tag that would touch the one before it is left off; the post and the read-out still say it. */
          const prev = days.slice(0, i).map((p, j) => (p.post ? j : -1)).filter((j) => j >= 0).pop();
          const tag = prev == null || (i - prev) * step >= (wide ? 110 : 44);
          return wide ? (
            <g key={`post-${i}`}>
              <line className="kit-horizon-post" x1={cx} x2={cx} y1={4} y2={top + H + 2} />
              {tag ? <text className="kit-horizon-tag" x={cx + 6} y={12}>{d.post.title}</text> : null}
            </g>
          ) : (
            <g key={`post-${i}`}>
              <line className="kit-horizon-post" x1={cx} x2={cx} y1={0} y2={H + 3} />
              {tag ? <text className="kit-horizon-tag" x={cx} y={H + 15} textAnchor="middle">{d.post.tag}</text> : null}
            </g>
          );
        })}
        {days.map((d, i) => {
          const x = i * step + (step - bw) / 2;
          const due = d.due ?? 0;
          const h = due ? Math.max(3, Math.round((due / max) * (H - 4))) : 0;
          return (
            <g key={`day-${i}`} className={sel === i ? "kit-horizon-day sel" : "kit-horizon-day"} onMouseEnter={() => setSel(i)}>
              <title>{`${d.label}: ${cardsDue(due)}${d.post ? ` · ${d.post.title}` : ""}`}</title>
              <rect className="kit-horizon-hit" x={i * step} y={0} width={step} height={top + H + foot} />
              {due ? (
                <rect className={i === 0 ? "kit-horizon-bar today" : "kit-horizon-bar"} x={x} y={top + H - h} width={bw} height={h} rx={2} />
              ) : (
                <line className="kit-horizon-zero" x1={x} x2={x + bw} y1={top + H - 0.5} y2={top + H - 0.5} />
              )}
              <line className="kit-horizon-tick" x1={x + 1} x2={x + bw - 1} y1={top + H - h - 4} y2={top + H - h - 4} />
              {wide ? (
                <text className={i === 0 ? "kit-horizon-dl today" : "kit-horizon-dl"} x={i * step + step / 2} y={top + H + 16} textAnchor="middle">
                  {d.short ?? d.label}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
      )}
      <span className="kit-horizon-line" aria-live="polite">{line}</span>
    </div>
  );
}
