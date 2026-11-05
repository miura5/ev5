import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: false,
      includeAssets: ["icon.svg"],
      manifest: {
        name: "E.V.",
        short_name: "E.V.",
        start_url: "/",
        scope: "/",
        display: "standalone",
        background_color: "#1f2937",
        theme_color: "#1f2937",
        icons: [{ src: "icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
      },
      workbox: {
        importScripts: ["retire-ev4.js"],
        globPatterns: ["**/*.{js,css,html,svg}"],
        navigateFallback: "index.html",
        navigateFallbackDenylist: [/^\/api\//, /^\/auth\//],
      },
    }),
  ],
  test: {
    environment: "jsdom",
    include: ["areas/**/*.test.{ts,tsx}", "shell/**/*.test.{ts,tsx}", "kit/**/*.test.{ts,tsx}", "domain/**/*.test.ts", "commands/**/*.test.ts"],
  },
});
