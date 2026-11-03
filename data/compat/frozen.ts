// The frozen copies of ev4's data contract: the 36 collection schemas (schemas/, byte-identical to ev4's
// spec/schemas/) and the per-collection rules extracted from ev4's spec (collections.json). SOURCE.md names the ev4
// commit and every file's SHA-256; frozen.test.ts fails when a file changes.
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export const COMPAT_DIR = import.meta.dirname;
export const SCHEMA_DIR = join(COMPAT_DIR, 'schemas');
const SUFFIX = '.schema.json';

export type Schema = Record<string, unknown> & {
  properties?: Record<string, Record<string, unknown>>;
  $defs?: Record<string, Record<string, unknown>>;
  'x-ev'?: { collection?: string; class?: string; writers?: string[]; documents?: Record<string, string> };
};

export interface CollectionRules {
  class: 'Fact' | 'Edit' | 'Derived' | 'Log' | 'Config';
  writers: string[];
  /** A mark is a field of a Fact that the named roles change in place. */
  marks?: Record<string, string[]>;
  /** An append map gains keys `<writer>-<YYYYMMDD-HHMMSS[mmm]>`, appended by the named writers. */
  appends?: Record<string, string[]>;
  /** Documents with a shape and class of their own (talk/memory, system/spec). */
  documents?: Record<string, { class: CollectionRules['class']; writers: string[] }>;
}

export interface Collections {
  documentBytes: number;
  batch: { maxWrites: number; maxBytes: number; ceilingBytes: number };
  collections: Record<string, CollectionRules>;
}

export const sha256 = (bytes: Buffer | string): string => createHash('sha256').update(bytes).digest('hex');

/** The schema files, sorted by name. */
export const schemaFiles = (): string[] =>
  readdirSync(SCHEMA_DIR)
    .filter(f => f.endsWith(SUFFIX))
    .sort();

let schemas: Record<string, Schema> | null = null;
/** {collection: schema} for every frozen collection. */
export function loadSchemas(): Record<string, Schema> {
  if (!schemas) {
    const out: Record<string, Schema> = {};
    for (const f of schemaFiles())
      out[f.slice(0, -SUFFIX.length)] = JSON.parse(readFileSync(join(SCHEMA_DIR, f), 'utf8')) as Schema;
    schemas = out;
  }
  return schemas;
}

let collections: Collections | null = null;
export function loadCollections(): Collections {
  collections ??= JSON.parse(readFileSync(join(COMPAT_DIR, 'collections.json'), 'utf8')) as Collections;
  return collections;
}

/** SOURCE.md's table: {relative path: sha256}, plus the ev4 commit it names. */
export function readSource(): { commit: string; hashes: Record<string, string> } {
  const text = readFileSync(join(COMPAT_DIR, 'SOURCE.md'), 'utf8');
  const commit = /ev4 commit: `([0-9a-f]{40})`/.exec(text)?.[1] ?? '';
  const hashes: Record<string, string> = {};
  for (const m of text.matchAll(/^\| `([^`]+)` \| `([0-9a-f]{64})` \|$/gm)) hashes[m[1]] = m[2];
  return { commit, hashes };
}
