import { useEffect, useState } from "react";
import { KitGallery } from "./KitGallery.tsx";
import { Shell } from "./Shell.tsx";
import { createServices } from "./services.ts";
import { useShellStatus } from "./useShellStatus.ts";

/** The bare root is Today: open it at /today so the address shows where Matt is. */
export const entryPath = (path: string): string =>
  path === "/" ? "/today" : path;

export function App({ path }: { path: string }) {
  const [at, setAt] = useState(() => entryPath(path));
  useEffect(() => {
    if (path === "/") window.history.replaceState(null, "", "/today");
  }, [path]);
  const [services] = useState(createServices);
  const status = useShellStatus(undefined, undefined, services.readCopy);
  if (path === "/kit") return <KitGallery />;
  const go = (to: string) => {
    window.history.pushState(null, "", to);
    setAt(to);
  };
  return (
    <Shell
      path={at}
      onNavigate={go}
      counts={status.counts}
      runningJob={status.runningJob}
      onOpenJob={() => go("/activity")}
      services={services}
    />
  );
}
