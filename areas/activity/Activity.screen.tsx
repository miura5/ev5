import { useEffect } from "react";
import { ActivityView } from "./Activity.view.tsx";
import { useJobs, type ReadCopyLike } from "./useJobs.ts";

/** The mounted view: unfinished jobs from /api/v1/jobs. */
export function ActivityScreen({
  services,
  onToast,
}: {
  services?: { readCopy?: ReadCopyLike };
  onToast?: (message: string) => void;
}) {
  const { jobs, loading, token, refused, error, dismiss } = useJobs(services?.readCopy);
  useEffect(() => {
    if (error && token && !refused) onToast?.(error);
  }, [error, token, refused, onToast]);
  // No token, or one the server refused: no data and no "nothing here"; the shell's token screen asks for it.
  if (!token || refused) return null;
  return (
    <>
      <ActivityView jobs={jobs} loading={loading} onDismiss={(id) => void dismiss(id)} />
    </>
  );
}
