// ajv over the frozen schemas, set up to judge exactly as ev4's own validator (core/validate.mjs) does:
//   - JSON Schema 2020-12, with only the keywords ev4 enforces (anything else makes the schema refused, so a schema
//     can never look stricter than it is); `x-ev` is an annotation.
//   - format date-time is ev4's ISO UTC time (YYYY-MM-DDTHH:MM:SS, up to 3 decimals, then Z) on a real calendar day;
//     format date is YYYY-MM-DD on a real calendar day. No other format exists.
//   - minLength and maxLength count UTF-16 code units (JavaScript's length), as ev4 does, not code points.
//   - patterns are Unicode regular expressions.
//   - a document listed in x-ev.documents (talk/memory, system/spec) is checked against its own shape.
import Ajv2020Module from 'ajv/dist/2020.js';
import type { ErrorObject, ValidateFunction } from 'ajv';
import { loadSchemas, type Schema } from './frozen.ts';

/** The JSON Schema keywords ev4's validator enforces, and the annotations it ignores. */
export const EV4_ASSERTIONS = new Set([
  'type', 'enum', 'const', 'properties', 'required', 'additionalProperties', 'patternProperties', 'propertyNames',
  'items', 'minItems', 'maxItems', 'uniqueItems', 'minLength', 'maxLength', 'pattern', 'format', 'minimum', 'maximum',
  '$ref', 'anyOf', 'oneOf', 'allOf', 'not',
]);
export const EV4_ANNOTATIONS = new Set([
  '$schema', '$id', '$comment', 'title', 'description', 'default', 'examples', '$defs', 'x-ev',
]);
export const EV4_FORMATS = ['date-time', 'date'];

const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
function realDate(s: string): boolean {
  const d = new Date(s.length === 10 ? s + 'T00:00:00Z' : s);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s.slice(0, 10);
}
export const isIsoTime = (s: string): boolean => ISO.test(s) && realDate(s);
export const isDay = (s: string): boolean => DAY.test(s) && realDate(s);

/** Every keyword a schema uses that ev4's validator would refuse, as "path: keyword" (empty when none). */
export function unsupportedKeywords(schema: unknown, at = '#'): string[] {
  if (typeof schema === 'boolean') return [];
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) return [`${at}: not a schema`];
  const s = schema as Record<string, unknown>;
  const out: string[] = [];
  for (const k of Object.keys(s)) if (!EV4_ASSERTIONS.has(k) && !EV4_ANNOTATIONS.has(k)) out.push(`${at}: ${k}`);
  if (typeof s.format === 'string' && !EV4_FORMATS.includes(s.format)) out.push(`${at}: format ${s.format}`);
  if (typeof s.$ref === 'string' && !/^#\/\$defs\/[\w-]+$/.test(s.$ref)) out.push(`${at}: $ref ${s.$ref}`);
  for (const k of ['properties', 'patternProperties', '$defs'])
    for (const [n, sub] of Object.entries((s[k] as Record<string, unknown>) || {}))
      out.push(...unsupportedKeywords(sub, `${at}/${k}/${n}`));
  for (const k of ['additionalProperties', 'items', 'propertyNames', 'not'])
    if (k in s) out.push(...unsupportedKeywords(s[k], `${at}/${k}`));
  for (const k of ['anyOf', 'oneOf', 'allOf'])
    ((s[k] as unknown[]) || []).forEach((sub, i) => out.push(...unsupportedKeywords(sub, `${at}/${k}/${i}`)));
  return out;
}

// ajv ships as CommonJS: under Node's ESM loader the class is the module's default export or its `default` field.
type AjvClass = typeof import('ajv/dist/2020.js').default;
const Ajv2020 = ((Ajv2020Module as unknown as { default?: AjvClass }).default ?? Ajv2020Module) as AjvClass;

// ajv marks `unicode: false` deprecated but still honours it; that one notice is dropped, every other warning kept.
const logger = {
  log: (...a: unknown[]) => console.log(...a),
  warn: (...a: unknown[]) => {
    if (!String(a[0]).startsWith('DEPRECATED: option unicode')) console.warn(...a);
  },
  error: (...a: unknown[]) => console.error(...a),
};

function makeAjv() {
  const ajv = new Ajv2020({
    allErrors: true,
    strict: true,
    strictTypes: false,
    strictRequired: false,
    allowUnionTypes: true,
    unicode: false,
    unicodeRegExp: true,
    validateFormats: true,
    // Meta-validation is off because ev4's sessions schema lists "source" twice in `required`, which the
    // meta-schema refuses and ev4 does not care about; unsupportedKeywords() and strict mode guard the keywords.
    validateSchema: false,
    logger,
  });
  ajv.addKeyword('x-ev');
  ajv.addFormat('date-time', { type: 'string', validate: isIsoTime });
  ajv.addFormat('date', { type: 'string', validate: isDay });
  return ajv;
}

let compiled: { whole: Map<string, ValidateFunction>; byDoc: Map<string, ValidateFunction> } | null = null;

function compileAll() {
  if (compiled) return compiled;
  const ajv = makeAjv();
  const all = loadSchemas();
  for (const [name, s] of Object.entries(all)) {
    const bad = unsupportedKeywords(s);
    if (bad.length) throw new Error(`${name} schema uses what ev4 does not enforce: ${bad.join(', ')}`);
    ajv.addSchema(s as Schema, name);
  }
  const whole = new Map<string, ValidateFunction>();
  const byDoc = new Map<string, ValidateFunction>();
  for (const [name, s] of Object.entries(all)) {
    whole.set(name, ajv.getSchema(name) as ValidateFunction);
    for (const [id, ref] of Object.entries(s['x-ev']?.documents ?? {}))
      byDoc.set(`${name}\n${id}`, ajv.compile({ $ref: `${String(s.$id)}${ref}` }));
  }
  compiled = { whole, byDoc };
  return compiled;
}

const line = (e: ErrorObject): string => {
  const where = e.instancePath || '(document)';
  if (e.keyword === 'additionalProperties')
    return `${e.instancePath}/${(e.params as { additionalProperty: string }).additionalProperty}: unknown field`;
  if (e.keyword === 'enum')
    return `${where}: must be one of ${(e.params as { allowedValues: unknown[] }).allowedValues.map(v => JSON.stringify(v)).join(', ')}`;
  return `${where}: ${e.message ?? e.keyword}`;
};

/** The schema check alone: [] when `doc` fits collection (and its own shape for an id x-ev.documents lists). */
export function schemaErrors(collection: string, doc: unknown, id?: string): string[] {
  const { whole, byDoc } = compileAll();
  const fn = (id !== undefined && byDoc.get(`${collection}\n${id}`)) || whole.get(collection);
  if (!fn) return [`(collection): no schema for ${collection}`];
  return fn(doc) ? [] : (fn.errors ?? []).map(line);
}

/** The writer values the frozen schema allows for collection (or for its document id). */
export function schemaWriters(collection: string, id?: string): string[] {
  const s = loadSchemas()[collection];
  if (!s) return [];
  const ref = id !== undefined ? s['x-ev']?.documents?.[id] : undefined;
  const shape = ref ? (s.$defs?.[ref.slice('#/$defs/'.length)] ?? s) : s;
  const w = (shape.properties as Record<string, { enum?: string[]; const?: string }> | undefined)?.writer;
  return w ? (w.enum ?? (w.const !== undefined ? [w.const] : [])) : [];
}
