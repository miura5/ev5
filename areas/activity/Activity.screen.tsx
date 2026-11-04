import { Toast } from "../../kit/index.ts";
import { ActivityView } from "./Activity.view.tsx";
import { useJobs, type ReadCopyLike } from "./useJobs.ts";

/** The mounted view: unfinished jobs from /api/v1/jobs. */
export function ActivityScreen({
  services,
}: {
  services?: { readCopy?: ReadCopyLike };
}) {
  const { jobs, token, refused, error, dismiss } = useJobs(services?.readCopy);
  // No token, or one the server refused: no data and no "nothing here"; the shell's token screen asks for it.
  if (!token || refused) return null;
  return (
    <>
      {error ? <Toast message={error} /> : null}
      <ActivityView jobs={jobs} onDismiss={(id) => void dismiss(id)} />
    </>
  );
}
