import { expect, test } from "vitest";
import { parseWeakSpotRow } from "../weak-spot/row.ts";

const T = "2026-11-03T15:00:00.000Z";
const N = 1_762_300_800_000;
const row = (
  c: string,
  data: unknown,
  extra: Record<string, unknown> = {},
) => ({ c, id: "x1", data, at: N, v: 1, ...extra });

const weakSpot = {
  schema: 2,
  writer: "page",
  at: T,
  source: "t",
  topic: "a",
  objective: "E4-3",
  kind: "concept",
  initial: { streak: 0 },
  events: {},
};
const kinds = [
  {
    c: "weakspots",
    parse: parseWeakSpotRow,
    data: weakSpot,
    bad: { ...weakSpot, kind: "other" },
  },
];

test.each(kinds)(
  "a $c row parses its document, and refuses a wrong shape",
  ({ c, parse, data, bad }) => {
    expect(parse(row(c, data)).data).toEqual(data);
    expect(() => parse(row(c, bad))).toThrow(); // a bad document
    expect(() => parse(row("other", data))).toThrow(); // the wrong collection
    expect(() => parse(row(c, data, { id: "" }))).toThrow();
    expect(() => parse(row(c, data, { v: 0 }))).toThrow();
    expect(() => parse(row(c, data, { at: -1 }))).toThrow();
    expect(() => parse(row(c, data, { extra: 1 }))).toThrow();
  },
);
