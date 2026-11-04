// Radix (§ui.mockup): a kit component that draws a menu, listbox, combobox or dialog, or handles ArrowDown/Escape itself,
// must get that behaviour from @radix-ui/* or cmdk; the kit owns the pixels only.
import type { Finding } from './lib.ts';
import { read } from './lib.ts';

const BEHAVIOUR = /role=["'{`]*\s*["'`]?(?:menu|listbox|combobox|dialog)\b|aria-modal|\bArrowDown\b|\bEscape\b/;
const LIBRARY = /from\s+['"](?:@radix-ui\/|cmdk['"/])/;

export function checkRadix(root: string, files: string[]): Finding[] {
  const out: Finding[] = [];
  for (const f of files) {
    if (!/^kit\/components\/.+\.tsx$/.test(f) || /\.(?:story|test)\.tsx$/.test(f)) continue;
    const text = read(root, f);
    const hit = BEHAVIOUR.exec(text);
    if (hit && !LIBRARY.test(text)) {
      out.push({ check: 'radix', file: f, detail: `draws or handles ${hit[0]} itself; import @radix-ui/* or cmdk for behaviour (§ui.mockup)` });
    }
  }
  return out;
}
