import { notBuilt, test } from "./gate5.ts";

test(
  "Study session: run one",
  notBuilt(
    "Sessions writes go straight to the server; the sessions doc shape is unverified",
  ),
);
