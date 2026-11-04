// Kit-only controls (§ui.kit-leads): a view under areas/ or shell/ draws no raw <input>, <button>, <select> or <textarea>.
// Only kit/ draws them; a look the kit lacks is added to kit/ first.
import type { Finding } from './lib.ts';
import { read } from './lib.ts';

const RAW = /<(input|button|select|textarea)(?=[\s/>])/;

export function checkControls(root: string, files: string[]): Finding[] {
  const out: Finding[] = [];
  for (const f of files) {
    if (!/^(?:areas|shell)\/.+\.tsx$/.test(f) || /\.(?:story|test)\.tsx$/.test(f)) continue;
    const hit = RAW.exec(read(root, f));
    if (hit) out.push({ check: 'controls', file: f, detail: `renders a raw <${hit[1]}>; use the kit component (Button, Field, TextArea, Choice, TextOptions...), adding it to kit/ first if missing (§ui.kit-leads)` });
  }
  return out;
}
