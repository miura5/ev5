import { notBuilt, test } from "./gate5.ts";

test(
  'Ask "is it ready?" while a job runs',
  notBuilt("Ask has no chat route (CONTRACT §job.no-chat-ask)"),
);
