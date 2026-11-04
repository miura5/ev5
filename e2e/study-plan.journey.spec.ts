import { notBuilt, test } from "./gate5.ts";

test(
  "Study plan: make and approve",
  notBuilt(
    "approval UI and change rounds need a browser plus a model run; job covered by gate4-e2e.yml",
  ),
);
