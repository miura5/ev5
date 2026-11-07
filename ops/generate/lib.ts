// Generated files (CONTRACT §cmd.generated, §drift.interface): the area registry, the command client and the
// interface block of each folder README. Pure over a root: `generate` returns {path: text}, nothing is written here.
import fs from 'node:fs';
import path from 'node:path';
import { CLIENT_BODY } from './client-body.ts';

const START = '<!-- generated:start -->';
const END = '<!-- generated:end -->';
const PLACEHOLDER = '<!-- interface and must-not lines are generated (S-13) -->';
const HEADER = '// generated, do not edit: node ops/generate/cli.ts';
const SKIP = new Set(['node_modules', '.git', 'dist', '.claude']);

const exists = (root: string, f: string): boolean => fs.existsSync(path.join(root, f));
const read = (root: string, f: string): string => fs.readFileSync(path.join(root, f), 'utf8');
const entries = (root: string, d: string): fs.Dirent[] =>
  fs.readdirSync(path.join(root, d), { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1));
const subdirs = (root: string, d: string): string[] =>
  exists(root, d) ? entries(root, d).filter(e => e.isDirectory() && !SKIP.has(e.name)).map(e => e.name) : [];
const filesOf = (root: string, d: string): string[] =>
  exists(root, d) ? entries(root, d).filter(e => e.isFile()).map(e => e.name) : [];

/** Names exported by a module: `export const|function|type|... Name` and `export { a, b }`. */
export function exportNames(source: string): string[] {
  const names = [...source.matchAll(/^export\s+(?:declare\s+)?(?:const|let|function\*?|class|type|interface|enum)\s+(\w+)/gm)].map(m => m[1]!);
  for (const m of source.matchAll(/^export\s*(?:type\s*)?\{([^}]*)\}/gm)) {
    for (const part of m[1]!.split(',')) {
      const name = part.trim().split(/\s+as\s+/).pop()!.trim();
      if (name) names.push(name);
    }
  }
  return [...new Set(names)];
}

/** The area folders (those with an area.ts) and the const each exports, in folder order. */
function areaModules(root: string): { dir: string; name: string }[] {
  const out: { dir: string; name: string }[] = [];
  for (const dir of subdirs(root, 'areas')) {
    if (!exists(root, `areas/${dir}/area.ts`)) continue;
    const name = exportNames(read(root, `areas/${dir}/area.ts`)).find(n => /^[a-z]\w*$/.test(n));
    if (name) out.push({ dir, name });
  }
  return out;
}

export function registryFile(root: string): string {
  const areas = areaModules(root);
  const lines = [HEADER, ''];
  for (const a of areas) lines.push(`import { ${a.name} } from "./${a.dir}/area.ts";`);
  lines.push('', `export const areas = [${areas.map(a => a.name).join(', ')}] as const;`, '');
  return lines.join('\n');
}

const commandFiles = (root: string): string[] => filesOf(root, 'commands').filter(f => f.endsWith('.command.ts'));

/** Command names declared in commands/*.command.ts (`name: 'a.b'`), in file then source order. */
function commandNamesOf(root: string): string[] {
  return commandFiles(root).flatMap(f => [...read(root, `commands/${f}`).matchAll(/\bname:\s*'([^']+)'/g)].map(m => m[1]!));
}


/** The palette entries as plain data, so the shell needs no zod (CONTRACT §ui.palette). */
function paletteData(root: string): string {
  const out: string[] = [];
  for (const f of commandFiles(root)) {
    const src = read(root, `commands/${f}`);
    for (const body of src.split(/defineCommand\(\{/).slice(1)) {
      if (!/palette:\s*true/.test(body)) continue;
      const name = /name:\s*'([^']+)'/.exec(body)?.[1];
      const title = /title:\s*'((?:[^'\\]|\\.)*)'/.exec(body)?.[1];
      const places = /places:\s*\[([^\]]*)\]/.exec(body)?.[1]?.match(/'([^']+)'/g)?.map(p => p.slice(1, -1));
      if (name && title) out.push(JSON.stringify({ name, title, ...(places ? { places } : {}) }));
    }
  }
  return out.join(',\n  ');
}

export function clientFile(root: string): string {
  const names = commandNamesOf(root);
  const union = names.length ? names.map(n => JSON.stringify(n)).join(' | ') : 'never';
  return [HEADER, '', `export type CommandName = ${union};`, '', 'export const commandNames: readonly CommandName[] = [' + names.map(n => JSON.stringify(n)).join(', ') + '];', '', 'export interface PaletteEntry {\n  name: CommandName;\n  title: string;\n  places?: readonly string[];\n}', '', 'export const paletteEntries: readonly PaletteEntry[] = [\n  ' + paletteData(root) + ',\n];', CLIENT_BODY].join('\n');
}

/** commands/all.generated.ts: every command array exported by a *.command.ts file, joined for the catalog. */
export function allCommandsFile(root: string): string {
  const groups = commandFiles(root).flatMap(f => {
    const name = /^export const (\w+) = \[/m.exec(read(root, `commands/${f}`))?.[1];
    return name ? [{ f, name }] : [];
  });
  return [HEADER, '', ...groups.map(g => `import { ${g.name} } from "./${g.f}";`), '',
    `export const all = [${groups.map(g => `...${g.name}`).join(', ')}] as const;`, ''].join('\n');
}

// What a folder offers: index.ts exports, schema and command files, job kinds, areas. '(none yet)' when empty.
function interfaceOf(root: string, dir: string): string {
  const items: string[] = [];
  if (exists(root, `${dir}/index.ts`)) items.push(...exportNames(read(root, `${dir}/index.ts`)));
  for (const f of filesOf(root, dir)) {
    const m = /^(.+)\.(schema|command)\.ts$/.exec(f);
    if (m) items.push(f);
  }
  if (dir === 'jobs') items.push(...subdirs(root, dir).filter(k => exists(root, `${dir}/${k}/job.ts`)).map(k => `job ${k}`));
  if (dir === 'areas') items.push(...areaModules(root).map(a => `area ${a.dir}`));
  if (/^areas\/[^/]+$/.test(dir) && exists(root, `${dir}/area.ts`)) items.push(...exportNames(read(root, `${dir}/area.ts`)));
  return items.length ? items.join(', ') : '(none yet)';
}

// The must-not line, from .dependency-cruiser.cjs (§drift.imports): the top folders `dir` may not import, and its
// npm allow-list. Read from the `only(...)` and `externals(...)` rules; '' when the folder has none.
function mustNotOf(root: string, dir: string): string {
  if (!exists(root, '.dependency-cruiser.cjs')) return '';
  const cfg = read(root, '.dependency-cruiser.cjs');
  const folders = /const FOLDERS = "([^"]+)"/.exec(cfg)?.[1]?.split('|') ?? [];
  const list = (call: string): string[] | undefined => {
    const m = new RegExp(`^\\s*${call}\\("${dir}", \\[([^\\]]*)\\]\\)`, 'm').exec(cfg);
    return m ? [...m[1]!.matchAll(/"([^"]+)"/g)].map(x => x[1]!) : undefined;
  };
  const allowed = list('only');
  if (!allowed) return '';
  const plain = (a: string): string => a.replace(/^\^|\$$/g, '').replace(/\\+\./g, '.');
  const parts = folders.filter(f => f !== dir).flatMap(f => {
    const own = allowed.filter(a => a.startsWith(`^${f}/`));
    if (own.length === 0) return [f];
    return own.includes(`^${f}/`) ? [] : [`${f} except ${own.map(plain).join(', ')}`];
  });
  const npm = list('externals');
  const tail = npm ? `; npm packages other than ${npm.join(', ')}` : '';
  return parts.length || tail ? `Must not import (§drift.imports): ${parts.join(', ') || '(no other folder)'}${tail}` : '';
}

function block(root: string, dir: string): string {
  const mustNot = dir ? mustNotOf(root, dir) : '';
  return [START, `Interface: ${interfaceOf(root, dir)}`, ...(mustNot ? [mustNot] : []), END].join('\n');
}

function readmes(root: string, d = ''): string[] {
  return entries(root, d || '.').flatMap(e => {
    const rel = path.join(d, e.name);
    if (e.isDirectory()) return SKIP.has(e.name) || (d === '' && e.name === 'docs') ? [] : readmes(root, rel);
    return e.name === 'README.md' ? [rel] : [];
  });
}

/** Every generated file as {path: text}. */
export function generate(root: string): Map<string, string> {
  const out = new Map<string, string>();
  out.set('areas/registry.generated.ts', registryFile(root));
  out.set('commands/client.ts', clientFile(root));
  out.set('commands/all.generated.ts', allCommandsFile(root));
  for (const f of readmes(root)) {
    const text = read(root, f);
    const dir = path.dirname(f);
    const b = block(root, dir === '.' ? '' : dir);
    if (text.includes(START) && text.includes(END)) {
      out.set(f, text.slice(0, text.indexOf(START)) + b + text.slice(text.indexOf(END) + END.length));
    } else if (text.includes(PLACEHOLDER)) {
      out.set(f, text.replace(PLACEHOLDER, b));
    }
  }
  return out;
}

/** Files whose text differs from what generate would write. */
export function stale(root: string, files: Map<string, string>): string[] {
  return [...files].filter(([f, text]) => !exists(root, f) || read(root, f) !== text).map(([f]) => f);
}

export function write(root: string, files: Map<string, string>): string[] {
  const changed = stale(root, files);
  for (const f of changed) fs.writeFileSync(path.join(root, f), files.get(f)!);
  return changed;
}
