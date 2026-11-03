import { useState } from "react";
import { KitGallery } from "./KitGallery.tsx";
import { Shell } from "./Shell.tsx";

export function App({ path }: { path: string }) {
  const [at, setAt] = useState(path);
  if (path === "/kit") return <KitGallery />;
  const go = (to: string) => {
    window.history.pushState(null, "", to);
    setAt(to);
  };
  return <Shell path={at} onNavigate={go} />;
}
