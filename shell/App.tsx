import { useState } from "react";
import { KitGallery } from "./KitGallery.tsx";
import { Shell } from "./Shell.tsx";
import { createServices } from "./services.ts";

export function App({ path }: { path: string }) {
  const [at, setAt] = useState(path);
  const [services] = useState(createServices);
  if (path === "/kit") return <KitGallery />;
  const go = (to: string) => {
    window.history.pushState(null, "", to);
    setAt(to);
  };
  return <Shell path={at} onNavigate={go} services={services} />;
}
