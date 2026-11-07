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
        icons: [
          {
            src: "icon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any",
          },
        ],
      },
      workbox: {
        // A new worker takes over at once. The plugin sets these only when it injects its own register script, and
        // the shell registers the worker itself (injectRegister: false), so without them a new build waits behind the
        // open tab and a reload keeps the old one.
        skipWaiting: true,
        clientsClaim: true,
        importScripts: ["retire-ev4.js"],
        globPatterns: ["**/*.{js,css,html,svg}"],
        navigateFallback: "index.html",
        navigateFallbackDenylist: [/^\/api\//, /^\/auth\//],
      },
    }),
  ],
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "dom",
          environment: "jsdom",
          include: [
            "areas/**/*.test.{ts,tsx}",
            "shell/**/*.test.{ts,tsx}",
            "kit/**/*.test.{ts,tsx}",
            // the browser-side command client needs window
            "commands/client.*.test.ts",
          ],
        },
      },
      {
        extends: true,
        test: {
          name: "node",
          environment: "node",
          include: [
            "domain/**/*.test.ts",
            "commands/**/*.test.ts",
            "data/**/*.test.ts",
            "jobs/**/*.test.ts",
            "server/**/*.test.ts",
            "ops/**/*.test.{ts,mjs}",
          ],
          exclude: [
            "ops/guards/**",
            "commands/client.*.test.ts",
            "**/node_modules/**",
          ],
        },
      },
      {
        extends: true,
        test: {
          name: "ops-guards",
          environment: "node",
          include: ["ops/guards/**/*.test.ts"],
          testTimeout: 120_000,
        },
      },
    ],
  },
});
