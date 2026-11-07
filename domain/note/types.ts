import { z } from 'zod';

// Note document (schema 1): a title and a body of
// blocks of plain-text runs with inline marks. No HTML is ever stored.
export const BLOCK_TYPES = ['p', 'h1', 'h2', 'h3', 'ul', 'ol', 'todo'] as const;
export const LIST_TYPES = ['ul', 'ol', 'todo'] as const;
export const MARKS = ['b', 'i', 'u', 's'] as const;

// The schema's limits, plus the 256 KB document cap (spec.capacity.documentBytes in ev4).
export const MAX = {
  blocks: 4000,
  runs: 400,
  text: 20000,
  href: 2000,
  title: 300,
  alt: 300,
  indent: 6,
  imgMin: 40,
  imgMax: 2000,
  documentBytes: 262144,
} as const;

export const IMG_KEY = /^note-images\/[A-Za-z0-9]{16,64}\.(png|jpg|webp|gif)$/;
export const HREF = /^https?:\/\/[^\s<>"]+$/;
export const ROW = /^[A-Za-z0-9]{1,16}$/;
const EARLIER_OF = /^n-[A-Za-z0-9-]{1,120}$/;
const TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

const time = z.string().refine((v) => TIME.test(v) && !Number.isNaN(Date.parse(v)), 'not a time');
const mark = z.literal(true).optional();

const runSchema = z.strictObject({
  text: z.string().max(MAX.text),
  b: mark,
  i: mark,
  u: mark,
  s: mark,
  href: z.string().max(MAX.href).regex(HREF).optional(),
});
export type Run = z.infer<typeof runSchema>;

const blockSchema = z.strictObject({
  type: z.enum([...BLOCK_TYPES, 'img']),
  runs: z.array(runSchema).max(MAX.runs),
  checked: z.boolean().optional(),
  indent: z.number().int().min(0).max(MAX.indent).optional(),
  key: z.string().regex(IMG_KEY).optional(),
  width: z.number().int().min(MAX.imgMin).max(MAX.imgMax).optional(),
  alt: z.string().max(MAX.alt).optional(),
  row: z.string().regex(ROW).optional(),
  col: z.union([z.literal(0), z.literal(1)]).optional(),
});
export type Block = z.infer<typeof blockSchema>;

export const noteSchema = z.strictObject({
  schema: z.literal(1),
  writer: z.literal('page'),
  at: time,
  createdAt: time,
  title: z.string().max(MAX.title),
  blocks: z.array(blockSchema).max(MAX.blocks),
  editedAt: time.optional(),
  earlierOf: z.string().regex(EARLIER_OF).optional(),
});
export type Note = z.infer<typeof noteSchema>;
