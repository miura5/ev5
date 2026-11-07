// The clipboard tokenizer (core/notes.mjs noteParseHtml): HTML as an inert tree, never the browser's parser and never
// the page's DOM, so nothing in it can run or load. Script, style and the like keep no content; comments and
// declarations go; entities are decoded into text.
export interface HNode {
  nodeType: 1 | 3;
  nodeName: string;
  nodeValue?: string;
  attrs: Record<string, string>;
  childNodes: HNode[];
}

export const HTML_MAX = 2000000;
const VOID = new Set('area base br col embed hr img input link meta param source track wbr'.split(' '));
const RAW = new Set('script style textarea title xmp iframe noembed noframes noscript plaintext'.split(' '));
export const BLOCK = new Set(
  'p div h1 h2 h3 h4 h5 h6 li pre blockquote section article header footer aside nav main address figure figcaption dt dd dl tr table tbody thead tfoot caption hr details summary center'.split(
    ' ',
  ),
);
const ENT: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  ndash: '–',
  mdash: '—',
  hellip: '…',
  lsquo: '‘',
  rsquo: '’',
  ldquo: '“',
  rdquo: '”',
  bull: '•',
  middot: '·',
  deg: '°',
  plusmn: '±',
  times: '×',
  divide: '÷',
  micro: 'µ',
  frac12: '½',
  frac14: '¼',
  frac34: '¾',
  le: '≤',
  ge: '≥',
  ne: '≠',
  larr: '←',
  rarr: '→',
  uarr: '↑',
  darr: '↓',
  copy: '©',
  reg: '®',
  trade: '™',
  sup2: '²',
  sup3: '³',
  alpha: 'α',
  beta: 'β',
  gamma: 'γ',
  delta: 'δ',
  mu: 'μ',
  shy: '',
};

const decode = (s: string): string =>
  s.replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]*);?/gi, (m, e: string) => {
    if (e[0] === '#') {
      const cp = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return cp > 0 && cp <= 0x10ffff && !(cp >= 0xd800 && cp <= 0xdfff) ? String.fromCodePoint(cp) : '';
    }
    return ENT[e] ?? ENT[e.toLowerCase()] ?? m;
  });

const el = (name: string, attrs: Record<string, string>): HNode => ({
  nodeType: 1,
  nodeName: name,
  attrs,
  childNodes: [],
});
const txt = (v: string): HNode => ({
  nodeType: 3,
  nodeName: '#text',
  nodeValue: v,
  attrs: {},
  childNodes: [],
});

export function parseHtml(html: string): HNode {
  const src = String(html || '').slice(0, HTML_MAX);
  const root = el('#root', {});
  const stack = [root];
  const top = () => stack[stack.length - 1]!;
  const closeTo = (name: string) => {
    for (let i = stack.length - 1; i > 0; i--)
      if (stack[i]!.nodeName === name) {
        stack.length = i;
        return;
      }
  };
  let i = 0;
  while (i < src.length) {
    const lt = src.indexOf('<', i);
    if (lt < 0 || lt > i) {
      top().childNodes.push(txt(decode(src.slice(i, lt < 0 ? src.length : lt))));
      if (lt < 0) break;
      i = lt;
      continue;
    }
    if (src.startsWith('<!--', i)) {
      const e = src.indexOf('-->', i + 4);
      i = e < 0 ? src.length : e + 3;
      continue;
    }
    if (src[i + 1] === '!' || src[i + 1] === '?') {
      const e = src.indexOf('>', i);
      i = e < 0 ? src.length : e + 1;
      continue;
    }
    const m = /^<(\/?)([a-zA-Z][a-zA-Z0-9:-]*)/.exec(src.slice(i, i + 64));
    if (!m) {
      top().childNodes.push(txt('<'));
      i++;
      continue;
    }
    const name = m[2]!.toLowerCase();
    let j = i + m[0].length;
    const attrs: Record<string, string> = {};
    let selfClose = false;
    while (j < src.length && src[j] !== '>') {
      const a = /^[\s/]*([^\s"'>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/.exec(src.slice(j, j + 4096));
      if (!a || !a[0]) {
        if (src[j] === '/') selfClose = true;
        j++;
        continue;
      }
      const k = a[1]!.toLowerCase();
      if (!(k in attrs)) attrs[k] = decode(a[2] ?? a[3] ?? a[4] ?? '');
      j += a[0].length;
      if (/\/\s*$/.test(a[0]) && src[j] === '>') selfClose = true;
    }
    if (src[j - 1] === '/') selfClose = true;
    i = j + 1;
    if (m[1]) {
      closeTo(name);
      continue;
    }
    if (RAW.has(name)) {
      // its content is text to a browser and nothing to a note: skip to its end tag
      const e = src.toLowerCase().indexOf('</' + name, i);
      const g = e < 0 ? -1 : src.indexOf('>', e);
      i = g < 0 ? src.length : g + 1;
      top().childNodes.push(el(name, attrs));
      continue;
    }
    // the implied ends a paste meets: a new block ends an open paragraph, a new item ends the open one
    if ((BLOCK.has(name) || name === 'ul' || name === 'ol') && top().nodeName === 'p') stack.pop();
    if (name === 'li') {
      for (let k = stack.length - 1; k > 0; k--) {
        const nn = stack[k]!.nodeName;
        if (nn === 'ul' || nn === 'ol') break;
        if (nn === 'li') {
          stack.length = k;
          break;
        }
      }
    }
    const node = el(name, attrs);
    top().childNodes.push(node);
    if (!VOID.has(name) && !selfClose) stack.push(node);
  }
  return root;
}
