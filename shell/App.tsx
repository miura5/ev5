import { useEffect, useState } from "react";
import { KitGallery } from "./KitGallery.tsx";
import { Shell } from "./Shell.tsx";
import { TokenGate } from "./TokenGate.tsx";
import { createServices } from "./services.ts";
import { usePins } from "./usePins.ts";
import { useShellStatus } from "./useShellStatus.ts";

/** The bare root is Today: open it at /today so the address shows where Matt is. */
export const entryPath = (path: string): string =>
  path === "/" ? "/today" : path;

export function App({ path }: { path: string }) {
  if (path === "/kit") return <KitGallery />;
  return (
    <TokenGate>
      {(useDifferentToken) => (
        <Body path={path} useDifferentToken={useDifferentToken} />
      )}
    </TokenGate>
  );
}

function Body({
  path,
  useDifferentToken,
}: {
  path: string;
  useDifferentToken: () => void;
}) {
  const [at, setAt] = useState(() => entryPath(path));
  useEffect(() => {
    if (path === "/") window.history.replaceState(null, "", "/today");
  }, [path]);
  const [services] = useState(createServices);
  const status = useShellStatus(undefined, undefined, services.readCopy);
  const pins = usePins(services.readCopy);
  const go = (to: string) => {
    window.history.pushState(null, "", to);
    setAt(to);
  };
  return (
    <Shell
      path={at}
      onNavigate={go}
      pins={pins}
      onOpenPin={(id) => {
        const to = pins.find((p) => p.id === id)?.to;
        if (to) go(to);
      }}
      counts={status.counts}
      runningJob={status.runningJob}
      onOpenJob={() => go("/activity")}
      services={services}
      onUseDifferentToken={useDifferentToken}
    />
  );
}
