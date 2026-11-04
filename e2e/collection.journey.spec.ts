import { notBuilt, test } from "./gate5.ts";

test(
  "Collection: make, move a note in, pin, delete, restore",
  notBuilt("collection write routes and pins are not built (cutover C13)"),
);
