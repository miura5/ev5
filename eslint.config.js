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
      "no-restricted-syntax": [
        "error",
        {
          selector: "ExportAllDeclaration",
          message: "No `export *`: re-export by name (CONTRACT §drift.imports).",
        },
      ],
      "max-lines": ["error", { max: 300 }],
      "no-warning-comments": [
        "error",
        { terms: ["@ts-ignore", "@ts-expect-error", "@ts-nocheck", "@ts-check"], location: "anywhere" },
      ],
    },
  },
  {
    // Dates and times on screen come from domain/time, in the user's time zone (ZONE in domain/time) (§job.schedule).
    files: ["areas/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "ExportAllDeclaration",
          message: "No `export *`: re-export by name (CONTRACT §drift.imports).",
        },
        {
          selector: "MemberExpression[property.name=/^toLocale(Date|Time)String$/]",
          message: "Format dates and times through domain/time, not toLocaleDateString or toLocaleTimeString (§job.schedule).",
        },
        {
          selector: "MemberExpression[object.name='Intl'][property.name='DateTimeFormat']",
          message: "Format dates and times through domain/time, not Intl.DateTimeFormat (§job.schedule).",
        },
        {
          selector: "MemberExpression[object.name='window'][property.name=/^(location|history)$/]",
          message: "A screen reads its address from the shell's search and path props and moves with onNavigate, never window.location or window.history (wouter-only-in-shell).",
        },
        {
          selector: "MemberExpression[object.name=/^(location|history)$/][property.name=/^(assign|replace|search|href|pathname|pushState|replaceState|back|forward)$/]",
          message: "A screen reads its address from the shell's search and path props and moves with onNavigate, never location or history (wouter-only-in-shell).",
        },
      ],
    },
  },
];
