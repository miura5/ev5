// Note document (ev4 notes schema 1, frozen in data/compat/schemas/notes.schema.json): a title, a course and a body of
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
  label: 80,
  alt: 300,
  indent: 6,
  imgMin: 40,
  imgMax: 2000,
  documentBytes: 262144,
} as const;

export type Run = {
  text: string;
  b?: true;
  i?: true;
  u?: true;
  s?: true;
  href?: string;
};

export type Block = {
  type: (typeof BLOCK_TYPES)[number] | 'img';
  runs: Run[];
  checked?: boolean;
  indent?: number;
  key?: string;
  width?: number;
  alt?: string;
  row?: string;
  col?: 0 | 1;
};

export type Note = {
  schema: 1;
  writer: 'page';
  at: string;
  source: string;
  createdAt: string;
  title: string;
  course?: string | null;
  label?: string;
  blocks: Block[];
  editedAt?: string;
  earlierOf?: string;
  archivedAt?: string | null;
  discardedAt?: string | null;
};
