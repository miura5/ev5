// Runs the Gate 5 journeys against staging: `E2E_URL=... E2E_TOKEN=... node e2e/gate5.spec.ts`. Exit 1 on any failure.
import { httpCall, runAll } from "./journeys.ts";

const base = process.env["E2E_URL"];
const token = process.env["E2E_TOKEN"];
if (!base || !token) {
  console.error("E2E_URL and E2E_TOKEN are required");
  process.exit(2);
}
const results = await runAll(httpCall(base, token), String(Date.now()));
for (const r of results)
  console.log(
    `${r.state.toUpperCase().padEnd(5)} ${r.name}${r.note ? ` -- ${r.note}` : ""}`,
  );
const failed = results.filter((r) => r.state === "fail").length;
console.log(
  `${results.filter((r) => r.state === "pass").length} passed, ${failed} failed, ${results.filter((r) => r.state === "todo").length} todo`,
);
process.exit(failed ? 1 : 0);
