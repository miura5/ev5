// S-08 spike: prints the pass/fail tables for the report (Markdown). `node report.ts`
import { runAll, PATHS } from './src/run.ts';
import { runEdits } from './src/edits.ts';

const { results, precheck, docResults } = runAll();
const mark = (deep: boolean, bytes: boolean) => (bytes ? 'pass' : deep ? 'keys' : 'FAIL');

console.log('precheck:', precheck.length ? precheck : 'ok');
for (const set of ['normal', 'loose'] as const) {
  const paths = set === 'normal' ? PATHS : [...PATHS, 'unnormalised'];
  console.log(`\n### ${set}\n\n| group | case | ${paths.join(' | ')} |\n|---|---|${paths.map(() => '---').join('|')}|`);
  const names = [...new Set(results.filter(r => r.set === set).map(r => r.name))];
  for (const n of names) {
    const rs = results.filter(r => r.set === set && r.name === n);
    console.log(`| ${rs[0].group} | ${n} | ${paths.map(p => { const x = rs.find(r => r.path === p)!; return mark(x.deep, x.bytes); }).join(' | ')} |`);
  }
}
console.log('\n### totals');
for (const p of [...PATHS, 'unnormalised']) {
  for (const set of ['normal', 'loose']) {
    const rs = results.filter(r => r.path === p && r.set === set);
    if (rs.length) console.log(`${set} ${p}: ${rs.filter(r => r.bytes).length}/${rs.length} byte-equal, ${rs.filter(r => r.deep).length}/${rs.length} deep-equal`);
  }
}
console.log('\n### docs');
for (const d of docResults) console.log(`| ${d.name} | ${d.from} | ${d.ok ? 'pass' : 'FAIL ' + d.why} |`);
console.log('\n### edits');
for (const e of runEdits()) console.log(`| ${e.name} | ${e.from} | ${e.ok ? 'pass' : 'FAIL'} | ${e.note} |`);
console.log('\n### failures');
for (const r of results) if (!r.bytes && r.path !== 'unnormalised') console.log(`${r.set} ${r.path} ${r.name}: ${r.error || r.diff?.slice(0, 220)}`);
for (const r of results) if (!r.bytes && r.path === 'unnormalised') console.log(`unnormalised ${r.name}: ${r.error || r.diff?.slice(0, 220)}`);
const big = results.filter(r => r.name.startsWith('4,000'));
console.log('\n4,000-line timings ms:', big.map(r => `${r.path} ${r.ms.toFixed(1)}`).join(', '));
