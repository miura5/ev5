/// <reference types="vite-plugin-pwa/vanillajs" />
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import { App } from "./App.tsx";
import { startPwa } from "./pwa.ts";

createRoot(document.getElementById("root")!).render(
  <App />,
);

if (import.meta.env.PROD) startPwa(registerSW);
