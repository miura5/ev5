import { useState } from "react";
import { ActivityView } from "./Activity.view.tsx";
import { useJobs, type ReadCopyLike } from "./useJobs.ts";

/** The mounted view: unfinished jobs from /api/v1/jobs. Without a token it asks for one, once per browser. */
export function ActivityScreen({
  services,
}: {
  services?: { readCopy?: ReadCopyLike };
}) {
  const { jobs, token, error, setToken, dismiss } = useJobs(
    services?.readCopy,
  );
  const [draft, setDraft] = useState("");
  if (!token)
    return (
      <form
        className="ev-activity"
        onSubmit={(e) => {
          e.preventDefault();
          if (draft.trim()) setToken(draft.trim());
        }}
      >
        <label className="ev-activity-meta" htmlFor="ev-token">
          Paste your app token to see Activity
        </label>
        <input
          id="ev-token"
          type="password"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
      </form>
    );
  return (
    <>
      {error ? <p className="ev-activity-meta">{error}</p> : null}
      <ActivityView jobs={jobs} onDismiss={(id) => void dismiss(id)} />
    </>
  );
}
