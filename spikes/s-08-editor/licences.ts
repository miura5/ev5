// Lists every installed package with its version, its package.json licence and the first line of its LICENSE file.
import fs from 'node:fs';
import path from 'node:path';

const nm = path.join(import.meta.dirname, 'node_modules');
const dirs: string[] = [];
for (const d of fs.readdirSync(nm)) {
  if (d.startsWith('.')) continue;
  if (d.startsWith('@')) for (const s of fs.readdirSync(path.join(nm, d))) dirs.push(path.join(d, s));
  else dirs.push(d);
}
for (const d of dirs.sort()) {
  const full = path.join(nm, d);
  const pj = path.join(full, 'package.json');
  if (!fs.existsSync(pj)) continue;
  const p = JSON.parse(fs.readFileSync(pj, 'utf8'));
  const lic = fs.readdirSync(full).find(f => /^licen[cs]e/i.test(f));
  const first = lic ? fs.readFileSync(path.join(full, lic), 'utf8').split('\n').find(l => l.trim()) : '(no LICENSE file)';
  console.log(`${p.name}\t${p.version}\t${p.license}\t${lic || '-'}\t${first?.trim()}`);
}
