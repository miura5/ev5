// Node-only door for tests: validateWrite reads the frozen ev4 files with node:fs, so it stays out of data/index.ts and
// the Worker bundle. Only *.test.ts files may import this (dependency-cruiser: compat-test-tests-only).
export { validateWrite } from './compat/validate.ts';
