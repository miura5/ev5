import { Button, Glyph, Row } from "../../kit/index.ts";
import "./activity.css";

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
export function ActivityView({ jobs, onOpen, onDismiss }: ActivityViewProps) {
  return (
    <section className="ev-activity" aria-label="Activity">
      <div className="ev-activity-head">
        <h1 className="ev-activity-title">Activity</h1>
        <span className="ev-activity-meta">
          what E.V. and the schedule are doing, and what waits on you
        </span>
      </div>
      {SECTIONS.map(({ title, states }) => {
        const rows = jobs.filter((j) =>
          (states as readonly string[]).includes(j.state),
        );
        return (
          <div className="ev-activity-sec" key={title} data-section={title}>
            <div className="ev-activity-sec-head">
              <h2 className="ev-activity-label">{title}</h2>
              <span className="ev-activity-meta">{rows.length || ""}</span>
            </div>
            {rows.length === 0 ? (
              <span className="ev-activity-meta">None.</span>
            ) : null}
            {rows.map((j) => {
              const row = (
                <Row
                  key={j.id}
                  title={j.title}
                  meta={j.reason ?? j.summary}
                  value={VALUE[j.state]}
                  glyph={<Glyph type="job" running={j.state === "running"} />}
                  onOpen={onOpen ? () => onOpen(j.id) : undefined}
                />
              );
              return j.dismissable && onDismiss ? (
                <div className="ev-activity-ack" key={j.id}>
                  {row}
                  <Button onClick={() => onDismiss(j.id)}>Got it</Button>
                </div>
              ) : (
                row
              );
            })}
          </div>
        );
      })}
    </section>
  );
}
