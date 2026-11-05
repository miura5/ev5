import { useEffect, useState } from "react";
import {
  Button,
  Empty,
  EvLine,
  Glyph,
  Meter,
  Page,
  Row,
  Section,
  Suggestion,
} from "../../kit/index.ts";
import { AddLine } from "./parts/AddLine.tsx";
import type { Readiness, TodayProps } from "./types.ts";
import "./today.css";

function readyLabel({ ready, shaky, weak }: Readiness) {
  return ready + shaky + weak === 0
    ? "Readiness: none yet"
    : `Readiness: ${ready}% ready, ${shaky}% shaky, ${weak}% weak`;
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
    <Page
      title="Today"
      meta={p.dateLabel}
      actions={
        <Button
          kind="primary"
          hint="S"
          onClick={p.onStartNext}
          disabled={open === 0}
        >
          Start next
        </Button>
      }
    >
      <EvLine quiet>
        <b>{p.say.lead}</b> {p.say.rest}
        {p.say.source ? (
          <span className="ev-today-cite"> {p.say.source}</span>
        ) : null}
      </EvLine>
      {p.alert ? (
        <EvLine>
          <b>Spend:</b> {p.alert}
        </EvLine>
      ) : null}
      <Section
        label="Plan"
        count={String(open)}
        onAdd={() => setAdding("plan")}
      >
        {adding === "plan" ? (
          <AddLine
            label="Add to today"
            onSubmit={(title) => p.onAddPlan(title)}
            onCancel={() => setAdding(null)}
          />
        ) : null}
        {p.plan.length === 0 ? (
          <Empty line="Nothing planned for today." />
        ) : null}
        {p.plan.map((i) => (
          <Row
            key={i.id}
            title={i.title}
            meta={i.meta}
            value={i.est}
            done={i.done}
            status={{ tone: i.tone }}
            selected={p.selectedId === i.id}
            onOpen={() => p.onOpen(i.id)}
            glyph={
              <Button
                kind="icon"
                aria-label={`${i.done ? "Mark not done" : "Mark done"}: ${i.title}`}
                aria-pressed={i.done}
                onClick={(e) => {
                  e.stopPropagation();
                  p.onTick(i.id, !i.done);
                }}
              >
                <Glyph type="plan" done={i.done} />
              </Button>
            }
          />
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
        label="Upcoming"
        addLabel="Add date"
        onAdd={() => setAdding("date")}
      >
        {adding === "date" ? (
          <AddLine
            label="Add a date"
            withDate
            onSubmit={(title, date) => p.onAddDate(title, date)}
            onCancel={() => setAdding(null)}
          />
        ) : null}
        {p.upcoming.length === 0 ? <Empty line="No dates coming up." /> : null}
        {p.upcoming.map((d) => (
          <div className="ev-today-date" key={d.id}>
            <Row
              title={d.title}
              meta={d.meta}
              value={d.when}
              status={{ tone: d.tone }}
              glyph={<Glyph type="date" />}
              selected={p.selectedId === d.id}
              onOpen={() => p.onOpen(d.id)}
            />
            <span className="ev-today-bar">
              <Meter
                label={readyLabel(d.readiness)}
                parts={[
                  { tone: "ok", count: d.readiness.ready },
                  { tone: "warn", count: d.readiness.shaky },
                  { tone: "bad", count: d.readiness.weak },
                ]}
              />
            </span>
          </div>
        ))}
      </Section>
      <Section label="This week">
        {p.thisWeek.length === 0 ? (
          <Empty line="Nothing else this week." />
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
    </Page>
  );
}
