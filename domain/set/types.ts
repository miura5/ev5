// Set document: a list of practice questions. Items never change once written; answers live in their own collection
// keyed by set id and item id, so a set holds no answers. The item formats are domain/item's.
import { z } from 'zod';
import { ITEM_TYPES, upgradeItem } from '../item/index.ts';

export const SET_KINDS = ['review', 'drill', 'sim', 'more', 'job', 'check'] as const;
export const SET_WRITERS = ['morning', 'worker', 'page'] as const;

const text = z.string().min(1);
const nonNeg = z.number().int().min(0);
const gridRowSchema = z.looseObject({
  text,
  correct: nonNeg,
  rationale: z.string().optional(),
});
/** @public */
export type GridRow = z.infer<typeof gridRowSchema>;
const keyPointSchema = z.looseObject({
  text: z.string(),
  keywords: z.array(z.array(text).min(1)).min(1),
});
/** @public */
export type KeyPoint = z.infer<typeof keyPointSchema>;
const chapters = z.union([z.string(), z.array(z.union([z.string(), z.number()]))]);

const setItemSchema = z.strictObject({
  id: text,
  stem: z.string(),
  kind: z.string().optional(),
  type: z.enum(ITEM_TYPES).optional(),
  options: z.array(text).max(6).optional(),
  correct: z.array(nonNeg).min(1).optional(),
  rationales: z.array(z.string()).optional(),
  grid: z
    .looseObject({
      columns: z.array(z.string()).min(2).max(4),
      rows: z.array(gridRowSchema).min(3).max(6),
    })
    .optional(),
  answer: z.number().optional(),
  unit: text.optional(),
  tolerance: z.number().min(0).optional(),
  steps: z.array(z.string()).min(1).max(12).optional(),
  weakspotId: z.string().optional(),
  objective: z.string().optional(),
  topic: z.string().optional(),
  verify: z.boolean().optional(),
  sourceRef: z
    .string()
    .regex(/^note\//)
    .nullish(),
  chapters: chapters.optional(),
  keyPoints: z.array(keyPointSchema).min(2).max(3).optional(),
  modelAnswer: text.optional(),
});
export type SetItem = z.infer<typeof setItemSchema>;

// answers and pastAttempts are refused because the object is strict: a set holds no answers.
export const studySetSchema = z.strictObject({
  schema: z.literal(3),
  writer: z.enum(SET_WRITERS),
  at: text,
  source: text,
  kind: z.enum(SET_KINDS),
  items: z.array(z.preprocess(upgradeItem, setItemSchema)).min(1),
  title: z.string().optional(),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  exam: z.string().nullable().optional(),
  planTaskId: z.string().optional(),
  objectives: z.array(z.string()).optional(),
  focus: z
    .union([z.string(), z.array(z.string())])
    .nullable()
    .optional(),
  asked: z.number().int().min(1).optional(),
  createdAt: z.string().optional(),
});
export type StudySet = z.infer<typeof studySetSchema>;

/** An answers document's `answers` map: item id -> attempt key -> attempt. */
export type SetAnswers = Record<string, Record<string, { at: string; correct?: boolean }>>;
