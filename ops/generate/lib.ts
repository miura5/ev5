// Generated files (CONTRACT §cmd.generated, §drift.interface): the area registry, the command client and the
// interface block of each folder README. Pure over a root: `generate` returns {path: text}, nothing is written here.
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

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

export function clientFile(root: string): string {
  const names = filesOf(root, 'commands').filter(f => f.endsWith('.command.ts')).map(f => f.slice(0, -'.command.ts'.length));
  const union = names.length ? names.map(n => JSON.stringify(n)).join(' | ') : 'never';
  return [HEADER, '', `export type CommandName = ${union};`, '', 'export const commandNames: readonly CommandName[] = [' + names.map(n => JSON.stringify(n)).join(', ') + '];', ''].join('\n');
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

// Import rules from .dependency-cruiser.cjs, as the folders each top-level folder may import.
function importRules(root: string): Map<string, string> {
  const cfg = createRequire(path.join(root, 'x.cjs'))(path.join(root, '.dependency-cruiser.cjs')) as {
    forbidden: { name: string; to: { pathNot?: string[] } }[];
  };
  const clean = (re: string): string => re.replace(/^\^/, '').replace(/\$$/, '').replace(/\\\./g, '.').replace(/\/$/, '').replace(/\.ts$/, '');
  const rules = new Map<string, string>();
  const npm = new Map<string, string[]>();
  for (const r of cfg.forbidden) {
    const imp = /^(\w+)-imports$/.exec(r.name);
    const ext = /^(\w+)-externals$/.exec(r.name);
    if (imp) rules.set(imp[1]!, (r.to.pathNot ?? []).slice(1).map(clean).join(', ') || 'nothing outside its folder');
    if (ext) npm.set(ext[1]!, (r.to.pathNot ?? []).map(p => p.replace(/^node_modules\//, '').replace(/\/$/, '')));
  }
  for (const [k, pkgs] of npm) rules.set(k, `${rules.get(k) ?? 'nothing outside its folder'}; npm: ${pkgs.join(', ')}`);
  return rules;
}

function block(root: string, dir: string, rules: Map<string, string>): string {
  const imports = rules.get(dir.split('/')[0]!) ?? "other folders through their index.ts";
  return [START, `Interface: ${interfaceOf(root, dir)}`, `Imports: ${imports} (§drift.imports)`, END].join('\n');
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
  const rules = importRules(root);
  for (const f of readmes(root)) {
    const text = read(root, f);
    const dir = path.dirname(f);
    const b = block(root, dir === '.' ? '' : dir, rules);
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
