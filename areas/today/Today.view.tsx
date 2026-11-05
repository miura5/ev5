import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Button, EvLine, Glyph, Row, Suggestion } from "../../kit/index.ts";
import { AddLine } from "./parts/AddLine.tsx";
import { ReadyBar } from "./parts/ReadyBar.tsx";
import type { TodayProps } from "./types.ts";
import "./today.css";

function Section({
  title,
  count,
  action,
  children,
}: {
  title: string;
  count?: number;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="ev-today-sec" aria-label={title}>
      <div className="ev-today-sec-head">
        <h2 className="ev-today-label">{title}</h2>
        {count === undefined ? null : (
          <span className="ev-today-meta">{count}</span>
        )}
        <span className="ev-today-grow" />
        {action}
      </div>
      {children}
    </section>
  );
}

/** Today: the plan list, E.V.'s suggestion, the dates coming up and the week. */
export function TodayView(p: TodayProps) {
  const open = p.plan.filter((i) => !i.done).length;
  const [adding, setAdding] = useState<"plan" | "date" | null>(null);
  // C opens the plan form from anywhere on Today, unless Matt is typing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (e.metaKey || e.ctrlKey || e.altKey || e.key.toLowerCase() !== "c")
        return;
      if (t?.closest?.("input, textarea, select, [contenteditable]")) return;
      e.preventDefault();
      setAdding("plan");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return (
    <div className="ev-today" data-area="today">
      <header className="ev-today-top">
        <div className="ev-today-head">
          <h1 className="ev-today-title">Today</h1>
          <span className="ev-today-meta">{p.dateLabel}</span>
          <span className="ev-today-grow" />
          <Button
            kind="primary"
            hint="S"
            onClick={p.onStartNext}
            disabled={open === 0}
          >
            Start next
          </Button>
        </div>
        <EvLine quiet>
          <b>{p.say.lead}</b> {p.say.rest}
          {p.say.source ? (
            <span className="ev-today-cite"> {p.say.source}</span>
          ) : null}
        </EvLine>
      </header>
      {p.alert ? (
        <EvLine>
          <b>Spend:</b> {p.alert}
        </EvLine>
      ) : null}
      <Section
        title="Plan"
        count={open}
        action={
          <Button kind="text" hint="C" onClick={() => setAdding("plan")}>
            Add
          </Button>
        }
      >
        {adding === "plan" ? (
          <AddLine
            label="Add to today"
            onSubmit={(title) => p.onAddPlan(title)}
            onCancel={() => setAdding(null)}
          />
        ) : null}
        {p.plan.length === 0 ? (
          <span className="ev-today-meta">Nothing planned for today.</span>
        ) : null}
        {p.plan.map((i) => (
          <div className="ev-today-line" key={i.id} data-tone={i.tone}>
            <Button
              kind="icon"
              aria-label={`${i.done ? "Mark not done" : "Mark done"}: ${i.title}`}
              aria-pressed={i.done}
              onClick={() => p.onTick(i.id, !i.done)}
            >
              <Glyph type="plan" done={i.done} />
            </Button>
            <Row
              title={i.title}
              meta={i.meta}
              value={i.est}
              selected={p.selectedId === i.id}
              onOpen={() => p.onOpen(i.id)}
            />
          </div>
        ))}
        {p.proposal ? (
          <Suggestion
            text={p.proposal.text}
            onAccept={p.onAccept}
            onEdit={p.onEdit}
            onDismiss={p.onDismiss}
          />
        ) : null}
      </Section>
      <Section
        title="Upcoming"
        action={
          <Button kind="text" onClick={() => setAdding("date")}>
            Add date
          </Button>
        }
      >
        {adding === "date" ? (
          <AddLine
            label="Add a date"
            withDate
            onSubmit={(title, date) => p.onAddDate(title, date)}
            onCancel={() => setAdding(null)}
          />
        ) : null}
        {p.upcoming.length === 0 ? (
          <span className="ev-today-meta">No dates coming up.</span>
        ) : null}
        {p.upcoming.map((d) => (
          <div
            className="ev-today-line ev-today-date"
            key={d.id}
            data-tone={d.tone}
          >
            <Row
              title={d.title}
              meta={d.meta}
              value={d.when}
              glyph={<Glyph type="date" />}
              selected={p.selectedId === d.id}
              onOpen={() => p.onOpen(d.id)}
            />
            <ReadyBar {...d.readiness} />
          </div>
        ))}
      </Section>
      <Section title="This week">
        {p.thisWeek.length === 0 ? (
          <span className="ev-today-meta">Nothing else this week.</span>
        ) : null}
        {p.thisWeek.map((w) => (
          <Row
            key={w.id}
            title={w.title}
            meta={w.meta}
            value={w.when}
            glyph={<Glyph type="job" />}
            onOpen={() => p.onOpen(w.id)}
          />
        ))}
      </Section>
    </div>
  );
}
