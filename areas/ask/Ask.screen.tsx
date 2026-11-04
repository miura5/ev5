import { useState } from "react";
import { AskView } from "./Ask.view.tsx";
import type { AskMessage } from "./types.ts";
import { useAskJobs } from "./useAskJobs.ts";

const clock = () =>
  new Date()
    .toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/Chicago" })
    .toLowerCase();

/** Shown after every send until the server has a chat route (none exists yet in server/). */
export const NOT_CONNECTED =
  "I can't answer here yet: the chat isn't connected to the server. Your note stays on screen.";

/** The mounted view. Unfinished jobs from /api/v1/jobs show as turns that link to Activity; typed messages stay local. */
export function AskScreen() {
  const [sent, setSent] = useState<AskMessage[]>([]);
  const jobs = useAskJobs();
  const jobTurns: AskMessage[] = jobs.map((j) => ({
    id: `job-${j.id}`,
    from: "ev",
    text: "This one is still open in Activity.",
    job: j.job,
  }));
  return (
    <AskView
      messages={[...jobTurns, ...sent]}
      onSend={(text) =>
        setSent((m) => [
          ...m,
          { id: `m${m.length + 1}`, from: "you", at: clock(), text },
          { id: `m${m.length + 2}`, from: "ev", text: NOT_CONNECTED },
        ])
      }
      onOpenJob={() => window.location.assign("/activity")}
    />
  );
}
