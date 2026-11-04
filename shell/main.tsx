import { createRoot } from "react-dom/client";
import { App } from "./App.tsx";
import { registerPwa } from "./pwa.ts";

createRoot(document.getElementById("root")!).render(
  <App path={window.location.pathname} />,
);

if (import.meta.env.PROD) registerPwa();
