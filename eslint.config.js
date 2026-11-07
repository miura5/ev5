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

// pictureApi.put takes any key at the type level, so only the notes picture part may call it (§cmd.registry); it also refuses other keys at run time.
const pictureDoorSyntax = [
  {
    selector: "CallExpression[callee.object.name='pictureApi']",
    message: "Only areas/notes/parts/notePictures.ts writes pictures, through pictureApi (note-images/ keys only). Others write through a registry command, call(name, input, token).",
  },
];

const areaSyntax = [
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

// The shell's host is the one way to show a Detail (§ui.kit-leads): a screen's own code never imports kit Detail as a value.
// Type imports stay (DetailProps), and tests and test hosts (testHost.tsx) mount a Detail to try a screen.
const detailSyntax = [
  {
    selector: "ImportDeclaration[source.value=/kit/][importKind!='type'] > ImportSpecifier[importKind!='type'][imported.name='Detail']",
    message: "A screen does not import kit Detail: the shell's host shows it, so export a detail renderer instead (§ui.kit-leads).",
  },
];

const exportAll = {
  selector: "ExportAllDeclaration",
  message: "No `export *`: re-export by name (CONTRACT §drift.imports).",
};

// SQL lives in data/ only (§data.gate, §data.protocol): no other folder (tests and ops aside) holds a prepare() with an
// INSERT, UPDATE, DELETE or REPLACE. A write belongs in a data/ repository, where the version pin and the Worker clock apply.
const sqlWrite = "/^\\s*(INSERT|UPDATE|DELETE|REPLACE)\\b/i";
const sqlAny = "/^\\s*(SELECT|WITH|INSERT|UPDATE|DELETE|REPLACE)\\b/i";
const sqlSyntax = (re, message) => [
  { selector: `CallExpression[callee.property.name='prepare'] > Literal:first-child[value=${re}]`, message },
  { selector: `CallExpression[callee.property.name='prepare'] > TemplateLiteral:first-child > TemplateElement:first-child[value.raw=${re}]`, message },
];
const sqlWriteSyntax = sqlSyntax(sqlWrite, "SQL writes live in data/; move this to a data/ repository (§data.gate).");
// In jobs/ no SQL at all: the job runtime reads and writes through data/ repositories.
const sqlAnySyntax = sqlSyntax(sqlAny, "jobs/ holds no SQL; read and write through a data/ repository (§data.gate).");

// Registry: no tool or command is defined outside commands/; the registry generates the rest.
const registryMessage = "A tool or command is defined in commands/ only; the registry generates the rest.";
const registrySyntax = [
  { selector: "Property[key.name='input_schema'], Property[key.value='input_schema']", message: registryMessage },
  { selector: "CallExpression[callee.name=/^(registerTool|defineTool|registerCommand|defineCommand)$/]", message: registryMessage },
];

// Kit-only controls (§ui.kit-leads): a view under areas/ or shell/ draws no raw input, button, select or textarea.
const controlsSyntax = [
  {
    selector: "JSXOpeningElement[name.name=/^(input|button|select|textarea)$/]",
    message: "Use the kit component (Button, Field, TextArea, Choice, TextOptions...), adding it to kit/ first if missing (§ui.kit-leads).",
  },
];
// In kit/ a checkbox input is the hidden twin of a drawn box: one without a className is the browser's own.
const kitCheckboxSyntax = [
  {
    selector: "JSXOpeningElement[name.name='input']:has(JSXAttribute[name.name='type'][value.value='checkbox']):not(:has(JSXAttribute[name.name='className']))",
    message: 'A raw <input type="checkbox">: draw the kit box beside it (className) as design/mockup.html .check .box (§ui.kit-leads).',
  },
];

// Radix (§ui.mockup): a kit component that draws a menu, listbox, combobox or dialog, or handles ArrowDown/Escape itself,
// must get that behaviour from @radix-ui/* or cmdk; the kit owns the pixels only.
const noLib = "Program:not(:has(ImportDeclaration[source.value=/^@radix-ui./], ImportDeclaration[source.value='cmdk']))";
const radixMessage = "Menu, listbox, combobox, dialog and ArrowDown/Escape behaviour comes from @radix-ui/* or cmdk (§ui.mockup).";
const radixSyntax = [
  { selector: `${noLib} JSXAttribute[name.name='role'][value.value=/^(menu|listbox|combobox|dialog)$/]`, message: radixMessage },
  { selector: `${noLib} JSXAttribute[name.name='aria-modal']`, message: radixMessage },
  { selector: `${noLib} Literal[value=/^(ArrowDown|Escape)$/]`, message: radixMessage },
];

const everywhere = [exportAll, ...sqlWriteSyntax, ...registrySyntax];
const rs = (...lists) => ["error", ...lists.flat()];

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
      "no-restricted-syntax": rs(everywhere),
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
  // A later block replaces the whole no-restricted-syntax list, so each folder's block repeats what it keeps.
  {
    files: ["jobs/**/*.ts"],
    rules: { "no-restricted-syntax": rs(exportAll, sqlAnySyntax, registrySyntax) },
  },
  {
    files: ["commands/**/*.{ts,tsx}"],
    rules: { "no-restricted-syntax": rs(exportAll, sqlWriteSyntax) },
  },
  {
    files: ["data/**/*.{ts,tsx}", "ops/**/*.{ts,tsx}"],
    rules: { "no-restricted-syntax": rs(exportAll, registrySyntax) },
  },
  {
    files: ["shell/**/*.tsx"],
    rules: { "no-restricted-syntax": rs(everywhere, controlsSyntax) },
  },
  {
    files: ["kit/**/*.tsx"],
    rules: { "no-restricted-syntax": rs(everywhere, kitCheckboxSyntax) },
  },
  {
    files: ["kit/components/**/*.tsx"],
    rules: { "no-restricted-syntax": rs(everywhere, kitCheckboxSyntax, radixSyntax) },
  },
  {
    // Dates and times on screen come from domain/time, in the user's time zone (ZONE in domain/time) (§job.schedule).
    files: ["areas/**/*.{ts,tsx}"],
    rules: { "no-restricted-syntax": rs(everywhere, areaSyntax, areaWriteSyntax, pictureDoorSyntax, controlsSyntax, detailSyntax) },
  },
  {
    // The one caller of the picture door.
    files: ["areas/notes/parts/notePictures.ts"],
    rules: { "no-restricted-syntax": rs(everywhere, areaSyntax, areaWriteSyntax, controlsSyntax, detailSyntax) },
  },
  {
    // Test hosts mount a Detail to try a screen, so they may import it.
    files: ["areas/**/testHost.tsx"],
    rules: { "no-restricted-syntax": rs(everywhere, areaSyntax, areaWriteSyntax, pictureDoorSyntax, controlsSyntax) },
  },
  {
    // Tests and stories set up what they test: no SQL, registry, controls or radix rules.
    files: ["**/*.test.{ts,tsx}", "**/*.testkit.ts", "**/*.story.tsx", "**/*.generated.*"],
    rules: { "no-restricted-syntax": rs(exportAll) },
  },
  {
    // Tests may call api() directly. Screens write through call() or a door in commands/client.ts (pictureApi).
    files: ["areas/**/*.test.{ts,tsx}"],
    rules: { "no-restricted-syntax": rs(exportAll, areaSyntax) },
  },
  {
    files: ["areas/**/*.story.tsx"],
    rules: { "no-restricted-syntax": rs(exportAll, areaSyntax, areaWriteSyntax, pictureDoorSyntax, detailSyntax) },
  },
];
