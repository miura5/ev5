import { ActivityView } from "./Activity.view.tsx";

/** The mounted view until the job_status data wiring lands: no jobs yet. */
export function ActivityScreen() {
  return <ActivityView jobs={[]} />;
}
