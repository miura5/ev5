import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    include: ["areas/**/*.test.{ts,tsx}", "shell/**/*.test.{ts,tsx}", "kit/**/*.test.{ts,tsx}", "domain/**/*.test.ts", "commands/**/*.test.ts"],
  },
});
