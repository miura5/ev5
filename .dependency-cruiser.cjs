// Import direction from PLAN §4 (CONTRACT §drift.imports).
const FOLDERS = "areas|shell|kit|commands|jobs|domain|data|server|ops";
const TESTS = "\\.test\\.tsx?$";

// `from` may import only the listed paths outside its own folder.
const only = (from, allowed) => ({
  name: `${from}-imports`,
  comment: `${from} imports only: ${allowed.join(", ") || "its own folder"}`,
  severity: "error",
  from: { path: `^${from}/`, pathNot: TESTS },
  to: { path: `^(${FOLDERS})/`, pathNot: [`^${from}/`, ...allowed] },
});

const externals = (from, allowed) => ({
  name: `${from}-externals`,
  comment: `${from} uses only ${allowed.join(", ")} from node_modules`,
  severity: "error",
  from: { path: `^${from}/`, pathNot: TESTS },
  to: { dependencyTypes: ["npm", "npm-dev", "npm-peer", "npm-optional", "npm-no-pkg", "npm-unknown"], pathNot: allowed.map((a) => `node_modules/${a}/`) },
});

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    { name: "no-cycles", severity: "error", from: {}, to: { circular: true } },
    {
      name: "only-through-index",
      comment: "other folders are reached through a folder's index.ts (commands/client.ts and area.ts are the generated doors)",
      severity: "error",
      from: { path: `^(${FOLDERS})/` },
      to: {
        path: `^(${FOLDERS})/`,
        // $1 is the importing folder: imports inside it are free
        pathNot: ["^$1/", "^[^/]+/index\\.ts$", "^commands/client\\.ts$", "^data/compat-test\\.ts$", "^areas/registry\\.generated\\.ts$", "^areas/[^/]+/(area\\.ts|[^/]+\\.view\\.tsx)$", "^jobs/[^/]+/[a-z-]*prompt\\.md$"],
      },
    },
    {
      name: "compat-test-tests-only",
      comment: "data/compat-test.ts pulls node:fs; only test files may import it",
      severity: "error",
      from: { pathNot: [TESTS, "^data/compat-test\\.ts$"] },
      to: { path: "^data/compat-test\\.ts$" },
    },
    only("areas", ["^kit/", "^domain/", "^commands/client\\.ts$"]),
    only("shell", ["^kit/", "^domain/", "^commands/client\\.ts$", "^areas/"]),
    only("commands", ["^domain/", "^data/", "^jobs/"]),
    only("jobs", ["^domain/", "^data/"]),
    only("domain", []),
    only("data", ["^domain/"]),
    only("server", ["^commands/", "^jobs/", "^data/", "^domain/"]),
    only("kit", []),
    externals("domain", ["zod", "ts-fsrs"]),
    externals("data", ["zod", "ajv"]),
    externals("kit", ["react", "react-dom", "@radix-ui", "cmdk"]),
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    exclude: { path: "^(docs|dist|\\.claude)/" },
  },
};
