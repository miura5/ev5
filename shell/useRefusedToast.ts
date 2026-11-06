import { useEffect } from "react";
import type { Services } from "./services.ts";

/** An outbox entry the server refused for good is shown as a toast with its reason, never kept silently (§data.offline). */
export function useRefusedToast(services: Services | undefined, show: (message: string) => void) {
  useEffect(
    () =>
      services?.outbox.onRefused?.((all) =>
        show(
          `${all.length} change${all.length === 1 ? " was" : "s were"} not saved: ${all[0]?.reason ?? ""}`,
        ),
      ),
    [services, show],
  );
}
