import { notBuilt, test } from "./gate5.ts";

test(
  "Practice set: do a set",
  notBuilt(
    "needs a model-written set in the browser (ANTHROPIC_API_KEY and a running job); the job runs in gate4-e2e.yml",
  ),
);
