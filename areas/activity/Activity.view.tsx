import { Button, Empty, Glyph, Page, Row, Section } from "../../kit/index.ts";

/** One job as job_status reports it (jobs/runtime/status.ts); areas never import jobs, so the shape is restated. */
export interface ActivityJob {
  id: string;
  title: string;
  state: "queued" | "running" | "needs-you" | "done" | "failed";
  /** Plain-words reason: what Matt must do, or why the job failed. */
  reason?: string;
  summary: string;
  /** An alert Matt can acknowledge (the monthly spend alert); acknowledging closes it. */
  dismissable?: boolean;
}

export interface ActivityViewProps {
  jobs: readonly ActivityJob[];
  /** The list has not arrived yet: the groups say so instead of "None.". */
  loading?: boolean;
  onOpen?: (id: string) => void;
  onDismiss?: (id: string) => void;
}

const SECTIONS = [
  { title: "Needs you", states: ["needs-you"] },
  { title: "Running", states: ["queued", "running"] },
  { title: "Done today", states: ["done", "failed"] },
] as const;

const VALUE: Record<ActivityJob["state"], string> = {
  queued: "Waiting",
  running: "Running",
  "needs-you": "Needs you",
  done: "Done",
  failed: "Failed",
};

/** Activity: what E.V. and the schedule are doing, and what waits on Matt. A failed job carries its reason. */
export function ActivityView({
  jobs,
  loading,
  onOpen,
  onDismiss,
}: ActivityViewProps) {
  return (
    <Page
      title="Activity"
      meta="what E.V. and the schedule are doing, and what waits on you"
    >
      {SECTIONS.map(({ title, states }) => {
        const rows = jobs.filter((j) =>
          (states as readonly string[]).includes(j.state),
        );
        return (
          <Section
            key={title}
            label={title}
            count={rows.length ? String(rows.length) : undefined}
          >
            {rows.length === 0 ? (
              <Empty line={loading ? "Loading…" : "None."} />
            ) : null}
            {rows.map((j) => (
              <Row
                key={j.id}
                title={j.title}
                meta={j.reason ?? j.summary}
                value={VALUE[j.state]}
                glyph={<Glyph type="job" running={j.state === "running"} />}
                onOpen={onOpen ? () => onOpen(j.id) : undefined}
                actions={
                  j.dismissable && onDismiss ? (
                    <Button onClick={() => onDismiss(j.id)}>Got it</Button>
                  ) : undefined
                }
              />
            ))}
          </Section>
        );
      })}
    </Page>
  );
}
