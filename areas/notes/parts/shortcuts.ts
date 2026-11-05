/** One thing the editor does from the keyboard: `bind` is its key (or typing rule) in editorKeys.ts, `shown` how Matt reads it. */
export interface Shortcut {
  label: string;
  bind: string;
  shown: (mac: boolean) => string;
}

const mod = (mac: boolean) => (mac ? "⌘" : "Ctrl+");
const shiftMod = (mac: boolean) => (mac ? "⇧⌘" : "Ctrl+Shift+");
const typed = (s: string) => () => s;

/** The hints the note page and ⌘K show; shortcuts.test.ts keeps them equal to the keys and rules in editorKeys.ts. */
export const SHORTCUTS: readonly Shortcut[] = [
  { label: "Heading 1", bind: "^#\\s$", shown: typed("# then space") },
  { label: "Heading 2", bind: "^##\\s$", shown: typed("## then space") },
  { label: "Heading 3", bind: "^###\\s$", shown: typed("### then space") },
  { label: "Bullet list", bind: "^[-*]\\s$", shown: typed("- or * then space") },
  { label: "Numbered list", bind: "^1\\.\\s$", shown: typed("1. then space") },
  { label: "Checklist", bind: "^\\[\\]\\s$", shown: typed("[] then space") },
  { label: "Indent", bind: "Tab", shown: typed("Tab") },
  { label: "Outdent", bind: "Shift-Tab", shown: typed("Shift+Tab") },
  { label: "Bold", bind: "Mod-b", shown: (m) => `${mod(m)}B` },
  { label: "Italic", bind: "Mod-i", shown: (m) => `${mod(m)}I` },
  { label: "Underline", bind: "Mod-u", shown: (m) => `${mod(m)}U` },
  { label: "Strikethrough", bind: "Shift-Mod-x", shown: (m) => `${shiftMod(m)}X` },
  { label: "Undo", bind: "Mod-z", shown: (m) => `${mod(m)}Z` },
  { label: "Redo", bind: "Shift-Mod-z", shown: (m) => `${shiftMod(m)}Z` },
  { label: "Redo (or)", bind: "Mod-y", shown: (m) => `${mod(m)}Y` },
];

/** The event the shell sends when Matt picks "Note shortcuts" in ⌘K. */
export const SHORTCUTS_EVENT = "ev5:note-shortcuts";

export const onMac = () =>
  typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
