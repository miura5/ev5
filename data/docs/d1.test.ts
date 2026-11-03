import test from 'node:test';
import assert from 'node:assert/strict';
import { registerProtocolSuite } from '../compat/index.ts';
import { d1Docs } from './index.ts';
import { fakeD1 } from './fake-d1.ts';

// The D1 repository passes the same suite as the in-memory reference.
registerProtocolSuite('d1 docs', clock => d1Docs(fakeD1(), { clock }), test);

test('a pin lost between the read and the write rolls the whole batch back and answers 409', async () => {
  const db = fakeD1();
  const a = d1Docs(db);
  await a.batch([
    { op: 'set', collection: 's', doc_id: 'a', data: { n: 1 } },
    { op: 'set', collection: 's', doc_id: 'b', data: { n: 1 } },
  ]);
  // Another writer lands on b after the repository has read it, before its batch runs.
  const prepare = db.prepare.bind(db);
  let raced = false;
  db.prepare = sql => {
    if (!raced && sql.startsWith('UPDATE docs')) {
      raced = true;
      db.sqlite.exec("UPDATE docs SET v = 2, data = '{\"n\":7}' WHERE id = 'b'");
    }
    return prepare(sql);
  };
  const r = await a.batch([
    { op: 'update', collection: 's', doc_id: 'a', data: { n: 2 }, if_version: 1 },
    { op: 'update', collection: 's', doc_id: 'b', data: { n: 2 }, if_version: 1 },
  ]);
  assert.equal(!r.ok && r.status, 409);
  assert.equal(!r.ok && r.entry, 1);
  assert.equal((await a.get('s', 'a'))?.v, 1, 'a was rolled back');
  assert.deepEqual((await a.get('s', 'b'))?.data, { n: 7 });
});

test('a row that is not an ev4 docs row is refused by the Zod parse, not passed on', async () => {
  const db = fakeD1();
  db.sqlite.exec('DROP TABLE docs');
  db.sqlite.exec("CREATE TABLE docs (c TEXT, id TEXT, data TEXT, at INTEGER, v INTEGER, PRIMARY KEY (c, id))");
  db.sqlite.exec("INSERT INTO docs VALUES ('s', 'x', '{}', 1, 0)");
  await assert.rejects(d1Docs(db).get('s', 'x'));
});
