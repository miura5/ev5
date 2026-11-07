// Kit tokens (CONTRACT §ui.kit-leads): every var(--x) a CSS file uses is defined in kit/tokens/tokens.css,
// or in the same file (a component's own local property). A missing token resolves to nothing, silently.
import type { Finding } from './lib.ts';
import { read } from './lib.ts';

const TOKENS = 'kit/tokens/tokens.css';

export function checkTokens(root: string, files: string[]): Finding[] {
  if (!files.includes(TOKENS)) return [];
  const defined = (css: string): Set<string> => new Set([...css.matchAll(/(--[\w-]+)\s*:/g)].map(m => m[1] as string));
  const known = defined(read(root, TOKENS));
  const out: Finding[] = [];
  for (const f of files) {
    if (!f.endsWith('.css') || f === TOKENS || /^(design|docs|dist)\//.test(f)) continue;
    const css = read(root, f).replace(/\/\*[\s\S]*?\*\//g, '');
    const local = defined(css);
    // A property its own component sets inline (style={{ "--part": n }}) is local too.
    const dir = f.slice(0, f.lastIndexOf('/') + 1);
    for (const s of files.filter(g => g.startsWith(dir) && g.indexOf('/', dir.length) < 0 && /\.tsx?$/.test(g)))
      for (const m of read(root, s).matchAll(/["'`](--[\w-]+)["'`]\s*:/g)) local.add(m[1] as string);
    const missing = new Set([...css.matchAll(/var\(\s*(--[\w-]+)/g)].map(m => m[1] as string).filter(v => !known.has(v) && !local.has(v)));
    for (const v of missing) out.push({ check: 'tokens', file: f, detail: `${v} is not defined in ${TOKENS}` });
  }
  return out;
}
