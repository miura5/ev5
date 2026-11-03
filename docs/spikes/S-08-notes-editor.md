# S-08 · Spike: the notes editor round trip

**Status:** done (model level, headless). The code is on the branch `claude/spike-s-08-editor` (folder `spikes/s-08-editor/`). That branch is never merged. To run it: `npm ci && node --test test/ && node report.ts` in that folder, on Node 26.

## Question
Can ProseMirror or Tiptap round-trip ev4's JSON note blocks with no loss? The test is blocks → editor doc → blocks, and the result must be deep-equal to the input. The cases cover every block type and mark in `spec/schemas/notes.schema.json`, the pure note model (`core/notes.mjs`, including the save allowlist `noteDoc` at lines 948–964), and the behaviours ev4's notes tests and harness check (`test/notes-editor.test.mjs`, `test/note-images.test.mjs`, `test/harness/notes.cjs`).

## Method
- **ev4 was only read.** Its schema was copied to `fixtures/` (SHA-256 `5a9cc640…19c0`, ev4 commit `3675ed6e`). The parts of the model a round trip needs were ported to TypeScript by reading them: `noteRuns`, `noteBlock`, `noteTidyRows`, `noteBlocks`, `noteTitleOf`, `noteEarlierTitle` and `noteDoc`. No ev4 code was run.
- **Schema (direct ProseMirror):** one node per ev4 type: `paragraph`, `heading{level}`, `bullet{indent}`, `ordered{indent}`, `todo{indent,checked}` and `image{key,width,alt}` (an atom). A two-column row is `row{id} > column column > block+`. The marks are `bold`, `italic`, `underline`, `strike` and `link{href}`. List items stay **flat**, with an `indent` attribute, as ev4 stores them.
- **The same schema as Tiptap extensions** (`Node.create` / `Mark.create`, then `getSchema`), with the same converters.
- **For comparison, Tiptap's stock extensions:** StarterKit, plus TaskList/TaskItem (nested) and Image, which nest lists as `bulletList > listItem > paragraph + list`. Rows still need custom nodes.
- **Paths per case:**
  - `direct-raw`: a plain mapping with no export rules;
  - `direct`: with the two export rules below;
  - `json+state`: `toJSON` → `JSON.parse` → `Node.fromJSON` → `EditorState` → a no-op transaction → export;
  - `tiptap`;
  - `stock-tiptap`.
- **Two bars for each result:** deep-equal (`isDeepStrictEqual`), and **byte-equal**, meaning `JSON.stringify` gives the same text. Byte-equality matters because ev4 stores `JSON.stringify` of the document as its canonical text (`pwa/runapi.js`), the backups hash that text, and `sameWords` (`pwa/bridge.js`) compares blocks by `JSON.stringify` to decide whether to make an "(earlier)" copy.
- **Corpus checks:** every corpus note validates against ev4's schema (ajv 2020). Every `normal` case is already in ev4's normal form (`noteBlocks(x)` is byte-equal to `x`).
- **Whole notes:** the editor holds only the blocks. The envelope stays outside it, and the save goes back through the ported `noteDoc`.
- **An edit sample:** 7 ev4 behaviours done as ProseMirror transactions, exported and compared with the blocks ev4's tests expect.

## Corpus (synthetic, 68 cases)
- **48 normal cases** (what ev4 stores):
  - every block type (`p`, `h1`–`h3`, `ul`, `ol`, `todo` ticked, unticked and empty, `img` with key only, width and alt, all four file types, widths 40 and 2000);
  - every mark alone, all 32 combinations of b/i/u/s/href, adjacent different links;
  - text: unicode, `<>&"'`, spaces, a run of exactly 20,000 characters, a 45,000-character run stored as 3 runs;
  - nesting: indents 1–6 on all three list kinds, a jump from 0 to 3, the first line indented, an indented item after a paragraph, kinds mixed across depths, empty items;
  - two-column rows: picture left and right, the harness row (p, h2 and ul beside a picture), rows touching and at both ends, a 16-character row id;
  - behaviour outputs copied from ev4's test expectations: SAMPLE, Enter split, mark toggle, sanitised paste, paste at the caret, picture insert and move, a heading typed in a column, 400 runs (the schema limit);
  - 4,000 lines of mixed types.
- **15 loose cases:** these are schema-valid but not in normal form. They include an empty run, neighbouring runs with the same marks, `checked` on a `p`, `indent` on a heading, `indent: 0`, a todo with no `checked`, a one-column row, columns out of order, a row with no `col`, a row split by another block, a picture with runs, a picture with no key, control characters, a ZWJ emoji, and zero blocks.
- **5 whole notes:** in a course; with a label, no course and archived; an `earlierOf` copy titled "(earlier)"; `discardedAt: null`; a note with a row and a picture.

## Results

### Totals (byte-equal)
| Path | Normal (48) | Loose, normalised first (15) |
|---|---|---|
| `direct` | **48 / 48** | **15 / 15** |
| `json+state` | **48 / 48** | **15 / 15** |
| `tiptap` (custom schema) | **48 / 48** | **15 / 15** |
| `direct-raw` (no export rules) | 46 / 48 (47 deep-equal) | 15 / 15 |
| `stock-tiptap` (nested lists) | 43 / 48 | 15 / 15 |

- **Whole notes, saved through `noteDoc`:** 5 / 5 byte-equal and schema-valid. That covers `label`, `course: null`, `archivedAt`, `discardedAt: null`, `earlierOf` and the "(earlier)" title.
- **Edit sample:** 6 / 7. The one that fails is a row left with one column (see below).
- **Speed:** the 4,000-line note round-trips in 4–11 ms on every path.

### By block type and behaviour (`direct`, `json+state` and `tiptap` are identical)
| Group | Cases | direct / tiptap | direct-raw | stock-tiptap |
|---|---|---|---|---|
| p, h1, h2, h3 (including empty) | 6 | pass | pass | pass |
| ul, ol | 2 | pass | pass | pass |
| todo (ticked, unticked, empty) | 2 | pass | pass | pass |
| img (key, width, alt, limits, types) | 4 | pass | pass | pass |
| marks b, i, u, s, href, links side by side | 6 | pass | pass | pass |
| all 32 mark combinations | 1 | pass | **key order** | pass |
| marks on headings and list items | 1 | pass | pass | pass |
| text (unicode, markup characters, spaces, 20,000-character run) | 4 | pass | pass | pass |
| a 45,000-character run (3 runs at the cap) | 1 | pass | **FAIL** | pass |
| nesting: depths 1–6, mixed kinds, empty items | 4 | pass | pass | pass |
| nesting: a jump from 0 to 3, the first line indented, indented after a p | 3 | pass | pass | **FAIL** |
| rows: picture left and right, harness row, 16-character id | 4 | pass | pass | pass |
| rows: touching, at the ends, an indented item first in a column | 1 | pass | pass | **FAIL** |
| behaviour outputs (8 cases) | 8 | pass | pass | pass |
| 4,000 lines | 1 | pass | pass | **FAIL** |
| whole notes (label, earlierOf, archived, discarded) | 5 | pass | n/a | n/a |

### Edit sample (ProseMirror transactions on the direct schema)
| ev4 behaviour | Result |
|---|---|
| Bold on across two lines, then off (`noteSetMark`) | pass |
| Enter in a marked list item continues the list | pass |
| Enter in a ticked todo makes an unticked item | pass, with `split(..., typesAfter)`. A plain split copies `checked: true` |
| Tick, indent, type change (`setNodeMarkup`) | pass |
| Picture resized and moved under the heading | pass |
| Enter in a column keeps the new line in the column | pass |
| Picture deleted out of its row, so the text goes full width | **FAIL**. ProseMirror keeps the column valid by putting an empty paragraph in it, so the row stays. No text is lost |

## Lossy cases and their causes
1. **Runs joined past ev4's 20,000-character cap** (`direct-raw`). ProseMirror merges neighbouring text with the same marks into one text node, so a 45,000-character run ev4 stored as 3 runs comes back as 1. That breaks the schema (`maxLength` 20000). *Fix:* re-split at the cap on export (`capRuns`).
2. **Run key order** (`direct-raw`, deep-equal but not byte-equal). ProseMirror lists marks in schema rank order, so a run with a link plus another mark comes out as `{text, href, b}` instead of ev4's `{text, b, i, u, s, href}`. Because ev4 stores and compares `JSON.stringify`, this would change the stored bytes and backup hashes, and could trigger needless "(earlier)" copies through `sameWords`. *Fix:* rebuild the keys in ev4's order on export (`ev4Order`).
3. **Nested lists can't hold ev4's indents** (`stock-tiptap`). ev4 lets an item sit more than one level deeper than the line before it: after a 0→3 jump, as the note's first line, or straight after a paragraph. A nested tree needs a parent item for each level, so empty items are invented: 2 blocks became 4, and 4,000 became 5,334. *Fix:* keep lists flat with an `indent` attribute, as the direct schema does. That means **not** using Tiptap's stock list extensions.
4. **Loose documents fed in without ev4's normaliser** (13 of 15 differ, 5 throw). The ones that throw are a one-column row, a row with no `col`, a row split by another block, a picture with no key, and zero blocks. ProseMirror's own content rules (`column: block+`, the required `key`, `doc: …+`) refuse them. The rest change silently: runs merge, stray `checked` and `indent` drop, columns reorder. *Fix:* load through ev4's `noteBlocks` first. ev4 does the same, so the result then matches ev4 exactly (15 / 15).
5. **A one-column row after an edit** (edit sample). ev4's rule is that a row with one column left goes full width. ProseMirror instead fills the empty column. *Fix:* a translated command, or an `appendTransaction`, that unwraps a row once a column is empty.

Not lossy, but worth knowing:
- ev4's `cleanText` removes U+200D, which breaks ZWJ emoji such as 👩‍⚕️ into two. v5 must keep that rule for byte parity.
- Tiptap's stock `link` adds `target`, `rel` and `class` attributes, and add-ons such as unique block ids add more. The export must drop anything with no ev4 field, because ev4's block and run schemas are `additionalProperties: false` and ev4 drops unknown note fields when it saves (PLAN §5.2).

## Licences (read from the installed `package.json` and `LICENSE` files, and from npm metadata, on 2026-11-02)
| Package | Version | Licence |
|---|---|---|
| prosemirror-model | 1.25.12 | MIT |
| prosemirror-state | 1.4.4 | MIT |
| prosemirror-transform | 1.12.4 | MIT |
| prosemirror-commands | 1.7.2 | MIT |
| prosemirror-view, -history, -keymap, -inputrules, -schema-list, -dropcursor, -gapcursor, -tables, -changeset (via @tiptap/pm) | 1.42.9, 1.5.1, 1.2.3, 1.5.1, 1.6.0, 1.8.4, 1.4.1, 1.8.5, 2.4.6 | MIT |
| orderedmap, rope-sequence, w3c-keyname | 2.1.1, 1.3.4, 2.2.8 | MIT |
| @tiptap/core, @tiptap/pm, @tiptap/starter-kit, @tiptap/extension-list, @tiptap/extension-image (and the 18 extensions StarterKit pulls in) | 3.32.2 | MIT |
| linkifyjs (via the Tiptap link extension) | 4.4.0 | MIT |
| ajv, ajv-formats (dev only) | 8.20.0, 3.0.1 | MIT |
| fast-uri (via ajv) | 3.1.9 | BSD-3-Clause |

- Everything a v5 editor would ship is MIT, so the PLAN §12 **[verify licence]** passes. Tiptap's paid or cloud extensions were not checked, because nothing here needs them.
- Tiptap 3.32.2 was published on 2026-10-30. Pin an exact version when building.

## Recommendation
**Use ProseMirror directly, with the custom flat schema from this spike.** Import `prosemirror-model`, `-state`, `-view`, `-transform`, `-commands`, `-history`, `-keymap` and `-inputrules`. All are MIT and from one maintainer.

Why not Tiptap: its stock extensions are what make it worth having, and they don't fit. Its nested lists lose data (cause 3), it has no two-column row, and its image has no R2 `key`. So the schema has to be custom either way. Tiptap with a custom schema passes exactly like ProseMirror (63 / 63), so it remains viable if its command API or React bindings are wanted. But it adds about 25 packages and a fast release cadence for little gain.

What must be translated from ev4:
1. **`noteBlocks` on load and `noteDoc` on save.** Every block leaving the editor goes through ev4's normaliser and save allowlist. The envelope (title, course, label, `earlierOf`, `archivedAt`, `discardedAt`, `createdAt`) never enters the editor doc.
2. **Two export rules:** re-split runs at 20,000 characters, and write keys in ev4's order.
3. **The schema shape:** flat list items with `indent` 0–6 (indents only on lists), `todo.checked`, `image{key,width,alt}` as an atom, rows as `row{id} > column × 2`, and only the five marks. Editor-only attributes or marks never reach storage.
4. **Commands that carry ev4's rules:**
   - Enter makes an unticked todo (`typesAfter`), and Enter on an empty list item ends the list;
   - Backspace at a line's start outdents, then turns the line into a paragraph, then joins it to the line above, but never across columns;
   - a row with an empty column unwraps;
   - indent is clamped to 0–6;
   - the typing shortcuts become input rules;
   - the 4,000-line and 400-run limits are refused, never cut (`noteFits`).
5. **Paste stays ev4's sanitiser** (`noteParseHtml` and `noteFromTree`, then `noteInsertBlocks`), handed to ProseMirror as a slice. ProseMirror's own DOM parser is not used on clipboard HTML.

Not covered (model level only): the view, meaning DOM rendering and parsing, IME, the clipboard in a browser, undo history, offline queueing of saves (PLAN §5.9). The Phase 5 Notes e2e journeys cover those.
