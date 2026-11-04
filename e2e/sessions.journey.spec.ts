import { expect, test } from "./gate5.ts";

test("Sessions: the sessions collection lists", async ({ api }) => {
  expect((await api("GET", "/api/v1/docs?collection=sessions")).status).toBe(
    200,
  );
});
