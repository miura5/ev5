import { Redirect, Route, Switch, useLocation, useSearch } from "wouter";
import { KitGallery } from "./KitGallery.tsx";
import { Shell } from "./Shell.tsx";
import { TokenGate } from "./TokenGate.tsx";
import { createServices } from "./services.ts";
import { usePins } from "./usePins.ts";
import { useShellStatus } from "./useShellStatus.ts";
import { useState } from "react";

/** Routing is wouter's: the address is the one source of the screen and its ?open= item. */
export function App() {
  return (
    <Switch>
      <Route path="/kit" component={KitGallery} />
      <Route path="/">
        <Redirect to="/today" replace />
      </Route>
      <Route>
        <TokenGate>
          {(useDifferentToken) => (
            <Body useDifferentToken={useDifferentToken} />
          )}
        </TokenGate>
      </Route>
    </Switch>
  );
}

function Body({ useDifferentToken }: { useDifferentToken: () => void }) {
  const [location, navigate] = useLocation();
  const search = useSearch();
  const at = search ? `${location}?${search}` : location;
  const [services] = useState(createServices);
  const status = useShellStatus(undefined, undefined, services.readCopy);
  const pins = usePins(services.readCopy);
  return (
    <Shell
      path={at}
      onNavigate={(to) => navigate(to)}
      pins={pins}
      onOpenPin={(id) => {
        const to = pins.find((p) => p.id === id)?.to;
        if (to) navigate(to);
      }}
      counts={status.counts}
      runningJob={status.runningJob}
      onOpenJob={() => navigate("/activity")}
      services={services}
      onUseDifferentToken={useDifferentToken}
    />
  );
}
