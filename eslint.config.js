// Tool-enforced thresholds live here (CONTRACT §drift.max-lines).
// TypeScript 7 ships no JS compiler API, so typescript-eslint cannot load. Babel parses the
// TypeScript instead, and `no-warning-comments` bans the `@ts-` comments `ban-ts-comment` would.
import babelParser from "@babel/eslint-parser";

export default [
  { ignores: ["dist/", "node_modules/", "fixtures/", "docs/", ".claude/"] },
  {
    files: ["**/*.{ts,tsx,js,mjs,cjs}"],
    languageOptions: {
      parser: babelParser,
      sourceType: "module",
      parserOptions: {
        requireConfigFile: false,
        babelOptions: { presets: ["@babel/preset-typescript"], parserOpts: { plugins: ["jsx"] } },
      },
    },
    // Inline `eslint-disable` and friends are ignored and reported (run with --max-warnings 0).
    linterOptions: { noInlineConfig: true, reportUnusedDisableDirectives: "error" },
    rules: {
      "max-lines": ["error", { max: 300 }],
      "no-warning-comments": [
        "error",
        { terms: ["@ts-ignore", "@ts-expect-error", "@ts-nocheck", "@ts-check"], location: "anywhere" },
      ],
    },
  },
];
