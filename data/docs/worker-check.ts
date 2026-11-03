// ev4's Worker write check, Worker-safe: the frozen notes schema and the size cap come in as JSON imports (bundled,
// no node:fs) and the schema is judged by a small interpreter, because ajv compiles with `new Function`, which a
// Worker refuses. The interpreter is ev4's own validator (core/validate.mjs) in the keyword subset the schemas use;
// worker-check.test.ts holds it to the same verdicts as the ajv check in data/compat on every notes sample.
import type { WriteProblem } from "../compat/protocol.ts";
import collections from "../compat/collections.json" with { type: "json" };
import notesSchema from "../compat/schemas/notes.schema.json" with { type: "json" };

type S = { [k: string]: unknown };
type Err = { path: string; message: string };

const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const realDate = (s: string): boolean => {
  const d = new Date(s.length === 10 ? `${s}T00:00:00Z` : s);
  return (
    !Number.isNaN(d.getTime()) &&
    d.toISOString().slice(0, 10) === s.slice(0, 10)
  );
};
const typeOf = (v: unknown): string =>
  v === null
    ? "null"
    : Array.isArray(v)
      ? "array"
      : typeof v === "number"
        ? Number.isInteger(v)
          ? "integer"
          : "number"
        : typeof v;
const same = (a: unknown, b: unknown): boolean =>
  JSON.stringify(a) === JSON.stringify(b);
const ptr = (p: string[]): string =>
  p.length ? `/${p.join("/")}` : "(document)";
const isObj = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === "object" && !Array.isArray(v);

function check(
  schema: unknown,
  v: unknown,
  path: string[],
  root: S,
  errors: Err[],
): void {
  if (schema === true) return;
  if (!isObj(schema)) {
    errors.push({ path: ptr(path), message: "not allowed here" });
    return;
  }
  const at = ptr(path);
  const add = (message: string) => errors.push({ path: at, message });
  if (typeof schema.$ref === "string")
    check((root.$defs as S)[schema.$ref.slice(8)], v, path, root, errors);
  if ("type" in schema) {
    const types = ([] as string[]).concat(schema.type as string | string[]);
    const actual = typeOf(v);
    if (
      !types.some(
        (t) => actual === t || (t === "number" && actual === "integer"),
      )
    ) {
      add(`expected ${types.join(" or ")}, got ${actual}`);
      return;
    }
  }
  if ("const" in schema && !same(v, schema.const))
    add(`must be ${JSON.stringify(schema.const)}`);
  if (Array.isArray(schema.enum) && !schema.enum.some((e) => same(e, v)))
    add("must be one of the allowed values");
  if (typeof v === "string") {
    if (typeof schema.minLength === "number" && v.length < schema.minLength)
      add(`shorter than ${schema.minLength}`);
    if (typeof schema.maxLength === "number" && v.length > schema.maxLength)
      add(`longer than ${schema.maxLength}`);
    if (
      typeof schema.pattern === "string" &&
      !new RegExp(schema.pattern, "u").test(v)
    )
      add(`does not match ${schema.pattern}`);
    if (schema.format === "date-time" && !(ISO.test(v) && realDate(v)))
      add("not an ISO UTC time (YYYY-MM-DDTHH:MM:SSZ)");
    if (schema.format === "date" && !(DAY.test(v) && realDate(v)))
      add("not a date (YYYY-MM-DD)");
  }
  if (typeof v === "number") {
    if (typeof schema.minimum === "number" && v < schema.minimum)
      add(`below ${schema.minimum}`);
    if (typeof schema.maximum === "number" && v > schema.maximum)
      add(`above ${schema.maximum}`);
  }
  if (Array.isArray(v)) {
    if (typeof schema.minItems === "number" && v.length < schema.minItems)
      add(`fewer than ${schema.minItems} items`);
    if (typeof schema.maxItems === "number" && v.length > schema.maxItems)
      add(`more than ${schema.maxItems} items`);
    if (
      schema.uniqueItems &&
      new Set(v.map((x) => JSON.stringify(x))).size !== v.length
    )
      add("items are not unique");
    if (schema.items !== undefined)
      v.forEach((x, i) =>
        check(schema.items, x, [...path, String(i)], root, errors),
      );
  }
  if (isObj(v)) {
    for (const r of (schema.required as string[] | undefined) ?? [])
      if (!Object.hasOwn(v, r))
        errors.push({ path: ptr([...path, r]), message: "required" });
    const props = (schema.properties as S | undefined) ?? {};
    const pats = Object.entries(
      (schema.patternProperties as S | undefined) ?? {},
    ).map(([p, s]) => [new RegExp(p, "u"), s] as const);
    for (const [k, x] of Object.entries(v)) {
      if (schema.propertyNames)
        check(schema.propertyNames, k, [...path, k], root, errors);
      let matched = false;
      if (Object.hasOwn(props, k)) {
        matched = true;
        check(props[k], x, [...path, k], root, errors);
      }
      for (const [re, s] of pats)
        if (re.test(k)) {
          matched = true;
          check(s, x, [...path, k], root, errors);
        }
      if (!matched && "additionalProperties" in schema) {
        if (schema.additionalProperties === false)
          errors.push({ path: ptr([...path, k]), message: "unknown field" });
        else check(schema.additionalProperties, x, [...path, k], root, errors);
      }
    }
  }
  for (const s of (schema.allOf as unknown[] | undefined) ?? [])
    check(s, v, path, root, errors);
  const run = (s: unknown): Err[] => {
    const e: Err[] = [];
    check(s, v, path, root, e);
    return e;
  };
  const passes = (s: unknown) => run(s).length === 0;
  const explain = (branches: unknown[], fallback: string) => {
    const typed = branches
      .map(run)
      .filter(
        (e) =>
          !e.some((x) => x.path === at && x.message.startsWith("expected ")),
      );
    if (typed.length === 1 && typed[0]) errors.push(...typed[0]);
    else add(fallback);
  };
  if (Array.isArray(schema.anyOf) && !schema.anyOf.some(passes))
    explain(schema.anyOf, "matches none of the allowed shapes");
  if (Array.isArray(schema.oneOf)) {
    const n = schema.oneOf.filter(passes).length;
    if (n === 0) explain(schema.oneOf, "matches none of the allowed shapes");
    else if (n > 1) add("must match exactly one allowed shape");
  }
  if (schema.not && passes(schema.not)) add("matches a forbidden shape");
}

/** The notes schema alone: the first error as "path message", or [] when the note fits. */
export function noteShapeErrors(doc: unknown): string[] {
  const errors: Err[] = [];
  check(notesSchema, doc, [], notesSchema as S, errors);
  return errors.map((e) => `${e.path} ${e.message}`);
}

const CAP = (collections as { documentBytes: number }).documentBytes;

/** ev4's Worker check for a write, as docsRepo's `problem`: a note fits its schema and the size cap, and its createdAt
 * and earlierOf never change once it exists. Other collections pass. Same verdicts as ev4WorkerProblem (data/compat). */
export const workerNoteProblem: WriteProblem = (collection, id, doc, prev) => {
  if (collection !== "notes") return null;
  const bad = noteShapeErrors(doc);
  if (bad.length) return `notes/${id} does not fit its shape: ${bad[0]}`;
  const size = new TextEncoder().encode(JSON.stringify(doc)).length;
  if (size > CAP)
    return `notes/${id} is ${size} bytes; a note holds at most ${CAP}`;
  if (isObj(prev) && isObj(doc))
    for (const k of ["createdAt", "earlierOf"])
      if (JSON.stringify(prev[k]) !== JSON.stringify(doc[k]))
        return `notes/${id}: ${k} is written once, when the note is made, and never changed`;
  return null;
};
