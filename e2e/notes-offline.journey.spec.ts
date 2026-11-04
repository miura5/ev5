import { notBuilt, test } from "./gate5.ts";

test(
  "Notes: write offline, then sync",
  notBuilt("needs the outbox and a service worker run in the browser"),
);
