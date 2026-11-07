import { expect, test } from "./gate5.ts";

test("Sessions: the sessions list reads", async ({ api }) => {
  expect((await api("GET", "/api/v1/sessions")).status).toBe(200);
});
