// Tool-enforced thresholds live here (CONTRACT §drift.max-lines).
// TypeScript 7 ships no JS compiler API, so typescript-eslint cannot load. Babel parses the
// TypeScript instead, and `no-warning-comments` bans the `@ts-` comments `ban-ts-comment` would.
import babelParser from "@babel/eslint-parser";
import reactHooks from "eslint-plugin-react-hooks";

// A write through api() in an area: a POST, PUT, PATCH or DELETE, or a body (which makes it a POST). Reads stay.
const writeMessage = "An area writes through a registry command, call(name, input, token) from commands/client.ts, not api().";
const areaWriteSyntax = [
  {
    selector: "CallExpression[callee.name='api'] > ObjectExpression > Property[key.name='method'][value.value=/^(POST|PUT|PATCH|DELETE)$/i]",
    message: writeMessage,
  },
  {
    selector: "CallExpression[callee.name='api'] > ObjectExpression > Property[key.name=/^(body|raw)$/]",
    message: writeMessage,
  },
];

const areaSyntax = [
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
];

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
    plugins: { "react-hooks": reactHooks },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "error",
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
    // Playwright fixtures call `use(...)`, which is not a React hook.
    files: ["e2e/**/*.ts"],
    rules: { "react-hooks/rules-of-hooks": "off" },
  },
  {
    // Seven effects read state on purpose (mount-once or re-read on a token/id change); each needs a design look, not a
    // mechanical dependency add. Remove a file from this list when its effect is fixed. New files are not exempt.
    files: [
      "areas/activity/useJobs.ts",
      "areas/collection/useCollection.ts",
      "areas/library/Library.screen.tsx",
      "areas/notes/Notes.screen.tsx",
      "areas/notes/parts/NoteEditor.tsx",
      "areas/sessions/useSessions.ts",
      "areas/today/useToday.ts",
    ],
    rules: { "react-hooks/exhaustive-deps": "off" },
  },
  {
    // Dates and times on screen come from domain/time, in the user's time zone (ZONE in domain/time) (§job.schedule).
    files: ["areas/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": ["error", ...areaSyntax, ...areaWriteSyntax],
    },
  },
  {
    // These screens still write through api() because no registry command carries the write yet. A file leaves this list
    // when its write moves to call() from commands/client.ts; new files are not exempt.
    //   Ask.screen.tsx: ask.send takes no chat_id.  notePictures.ts: a raw picture upload.
    //   useSessions.ts, useToday.ts: whole-document PUT /docs (no command; goes with the docs removal).
    files: [
      "areas/**/*.test.{ts,tsx}",
      "areas/ask/Ask.screen.tsx",
      "areas/notes/parts/notePictures.ts",
      "areas/sessions/useSessions.ts",
      "areas/today/useToday.ts",
    ],
    rules: { "no-restricted-syntax": ["error", ...areaSyntax] },
  },
];

