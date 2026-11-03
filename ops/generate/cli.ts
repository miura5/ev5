// node ops/generate/cli.ts [--check] [--root <repo>]: writes the generated files; --check writes nothing and exits 1
// listing the stale ones.
import { generate, stale, write } from './lib.ts';

const i = process.argv.indexOf('--root');
const root = i > 0 ? process.argv[i + 1]! : new URL('../..', import.meta.url).pathname;
const files = generate(root);
if (process.argv.includes('--check')) {
  const old = stale(root, files);
  for (const f of old) console.log(`stale: ${f}`);
  console.log(old.length ? `${old.length} stale file(s); run npm run generate` : 'generated files up to date');
  process.exit(old.length ? 1 : 0);
}
for (const f of write(root, files)) console.log(`wrote ${f}`);
