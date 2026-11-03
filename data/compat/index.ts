// data/compat: ev4's data contract, frozen, as v5 must keep it while ev4 and v5 share one D1 (PLAN §5).
export { canonicalJson, canonicalText, finiteJson, NOT_JSON, TOO_LARGE } from './canonical.ts';
export type { Json, CanonicalResult } from './canonical.ts';
export {
  MAX_WRITES,
  MAX_BODY,
  NO_DELETE,
  validCollection,
  validDocId,
  merge,
  checkWrites,
  planBatch,
  staleRefusal,
} from './protocol.ts';
export type {
  ProtocolAdapter,
  StoredDoc,
  Write,
  Refusal,
  SaveResult,
  BatchResult,
  WriteProblem,
  PlannedRow,
} from './protocol.ts';
export { memoryAdapter, OVERLAP_MS } from './memory-adapter.ts';
export type { MemoryAdapterOptions } from './memory-adapter.ts';
export { PROTOCOL_CASES, registerProtocolSuite, testClock, goodNote } from './protocol-suite.ts';
export type { ProtocolCase, MakeAdapter, TestClock } from './protocol-suite.ts';
export { validateWrite, ev4WorkerProblem, writersOf, docBytes } from './validate.ts';
export type { WriteOptions, WriteVerdict } from './validate.ts';
export { schemaErrors, schemaWriters, unsupportedKeywords, isIsoTime, isDay } from './schema-check.ts';
export { changeProblems, keyWriter, stableStringify } from './facts.ts';
export { loadSchemas, loadCollections, readSource, schemaFiles, sha256, COMPAT_DIR, SCHEMA_DIR } from './frozen.ts';
export type { Schema, Collections, CollectionRules } from './frozen.ts';
