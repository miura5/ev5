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

const commandFiles = (root: string): string[] => filesOf(root, 'commands').filter(f => f.endsWith('.command.ts'));

/** Command names declared in commands/*.command.ts (`name: 'a.b'`), in file then source order. */
function commandNamesOf(root: string): string[] {
  return commandFiles(root).flatMap(f => [...read(root, `commands/${f}`).matchAll(/\bname:\s*'([^']+)'/g)].map(m => m[1]!));
}

const CLIENT_BODY = `
// The one door from the screens to the server (CONTRACT §cmd.registry, §drift.imports): areas and the shell call
// commands and read the API here, never with a raw fetch of their own.
export interface ApiOptions {
  method?: string;
  body?: unknown;
  /** Raw bytes sent as they are (a picture), with their content type; wins over \`body\`. */
  raw?: { data: Blob | ArrayBuffer; contentType: string };
}

export const TOKEN_KEY = "ev5.token";
/** The event api() fires on window when the server refuses the token (401); the shell listens, nothing forgets the token. */
export const UNAUTHORIZED_EVENT = "ev5:unauthorized";

// If storage is blocked (private window, site data off) the token lasts this visit only.
let visitToken = "";

/** The app token kept in this browser; "" when none. */
export function readToken(): string {
  try {
    return localStorage.getItem(TOKEN_KEY) ?? visitToken;
  } catch {
    return visitToken;
  }
}

/** Keep the token (replacing any earlier one). */
export function saveToken(token: string): void {
  visitToken = token;
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    /* blocked: this visit only */
  }
}

/** Forget the token, only when Matt asks to. */
export function forgetToken(): void {
  visitToken = "";
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* blocked */
  }
}

export type FailureKind = "refused" | "offline" | "server";

/** What a failed call was: a refused token (401), no connection (a rejected fetch), or anything else. */
export function failureKind(e: unknown): FailureKind {
  if (e instanceof TypeError) return "offline";
  const status = typeof e === "number" ? e : (e as { status?: unknown } | null)?.status;
  return status === 401 ? "refused" : "server";
}

/** The plain sentence for a failed call (an error, a status number or a failure kind), never the server's own text. */
export function failureSentence(e: unknown): string {
  const kind = e === "refused" || e === "offline" || e === "server" ? e : failureKind(e);
  if (kind === "refused") return "E.V. did not accept this token. Paste the app token again.";
  if (kind === "offline") return "No connection right now. Try again when you are back online.";
  return "Something went wrong on E.V.'s side. Try again in a moment.";
}

/** An /api/v1 request with the app token Matt keeps in this browser. \`path\` is relative to /api/v1. */
export async function api(path: string, token: string, o: ApiOptions = {}): Promise<Response> {
  const headers: Record<string, string> = { authorization: \`Bearer \${token}\` };
  const sent = o.raw ? o.raw.data : o.body === undefined ? undefined : JSON.stringify(o.body);
  if (o.raw) headers["content-type"] = o.raw.contentType;
  else if (o.body !== undefined) headers["content-type"] = "application/json";
  const r = await fetch(\`/api/v1/\${path}\`, {
    method: o.method ?? (sent === undefined ? "GET" : "POST"),
    headers,
    ...(sent === undefined ? {} : { body: sent }),
  });
  if (r.status === 401 && typeof window !== "undefined") window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
  return r;
}

/** What the command route answers: a Suggestion for an E.V. propose call, or the handler's result. */
export type CallResult =
  | { ok: true; mode: "direct" | "propose"; suggestion?: { command: string; input: unknown; title: string }; result?: unknown }
  | { ok: false; status: number; reason: string }; // reason: plain words (failureSentence), status 0 when offline

/** Call a registry command by name; the server checks the caller and the input (§cmd.propose). */
export async function call(name: CommandName, input: unknown, token: string): Promise<CallResult> {
  let r: Response;
  try {
    r = await api(\`commands/\${name}\`, token, { body: { input } });
  } catch (e) {
    return { ok: false, status: 0, reason: failureSentence(e) };
  }
  const b = (await r.json().catch(() => ({}))) as Record<string, unknown>;
  // The reason is always a plain sentence by kind, never the server's own text or a status code.
  if (!r.ok) return { ok: false, status: r.status, reason: failureSentence(r.status) };
  return { ok: true, mode: b.mode as "direct" | "propose", suggestion: b.suggestion as never, result: b.result };
}

/** The shell's saved-copy reader (shell/readCopy.ts), restated: the shell hands it to the areas (§data.offline). */
export interface ReadCopyLike {
  read<T>(key: string, fetcher: () => Promise<T>): Promise<T>;
}

/** A read the server refused (wrong token, server error): never "offline", so it is never kept as the saved copy. */
export class ApiError extends Error {
  constructor(readonly status: number) {
    super(\`request failed: \${status}\`);
  }
}

/** GET a JSON read. With a saved copy, a rejected fetch (offline) gives back the last good answer; 401 and 5xx throw. */
export function readJson<T>(path: string, token: string, key: string, copy?: ReadCopyLike, pick: (body: unknown) => T = b => b as T): Promise<T> {
  const get = async (): Promise<T> => {
    const r = await api(path, token);
    if (!r.ok) throw new ApiError(r.status);
    return pick(await r.json());
  };
  return copy ? copy.read(key, get) : get();
}

/** Job helpers: the activity list, one job, and answering a job that needs you. */
export const jobApi = {
  /** The unfinished jobs (the \`jobs\` array of GET /jobs), kept under "jobs". */
  list: (token: string, copy?: ReadCopyLike) =>
    readJson<unknown[]>("jobs", token, "jobs", copy, b => (b as { jobs: unknown[] }).jobs),
  get: (id: string, token: string, copy?: ReadCopyLike) =>
    readJson<unknown>(\`jobs/\${encodeURIComponent(id)}\`, token, \`job:\${id}\`, copy),
  answer: (id: string, answer: unknown, token: string) => api(\`jobs/\${encodeURIComponent(id)}/continue\`, token, { body: { answer } }),
};
`;

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
  out.set('commands/all.generated.ts', allCommandsFile(root));
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
