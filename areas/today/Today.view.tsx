import type { ReactNode } from "react";
import { Button, EvLine, Glyph, Row, Suggestion } from "../../kit/index.ts";
import { ReadyBar } from "./parts/ReadyBar.tsx";
import type { TodayProps } from "./types.ts";
import "./today.css";

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count?: number;
  children: ReactNode;
}) {
  return (
    <section className="ev-today-sec" aria-label={title}>
      <div className="ev-today-sec-head">
        <h2 className="ev-today-label">{title}</h2>
        {count === undefined ? null : (
          <span className="ev-today-meta">{count}</span>
        )}
      </div>
      {children}
    </section>
  );
}

/** Today: the plan list, E.V.'s suggestion, the dates coming up and the week. */
export function TodayView(p: TodayProps) {
  const open = p.plan.filter((i) => !i.done).length;
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
      <Section title="Plan" count={open}>
        {p.plan.length === 0 ? (
          <span className="ev-today-meta">Nothing planned for today.</span>
        ) : null}
        {p.plan.map((i) => (
          <div className="ev-today-line" key={i.id} data-tone={i.tone}>
            <Row
              title={i.title}
              meta={i.meta}
              value={i.est}
              glyph={<Glyph type="plan" done={i.done} />}
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
      <Section title="Upcoming">
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
      {p.thisWeek.length > 0 ? (
        <Section title="This week">
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
      ) : null}
    </div>
  );
}
