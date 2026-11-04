import { notBuilt, test } from "./gate5.ts";

test(
  "Plan today: add, edit, delete and restore a plan item",
  notBuilt(
    "Today has no plan-item writes yet; dayedits doc shape is unverified",
  ),
);
