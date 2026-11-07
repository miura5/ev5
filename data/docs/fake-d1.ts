// An in-memory stand-in for D1 that understands exactly the statements data/docs sends (test use only).
import type { D1Like, D1Statement } from "../d1.ts";

type Val = string | number | null;
interface DocRow {
  c: string;
  id: string;
  data: string;
  at: number;
  v: number;
}
export interface FakeD1 extends D1Like {
  docs: Map<string, DocRow>;
  deletions: Map<string, { c: string; id: string; at: number }>;
  /** Run before the next batch applies (to simulate a write landing between a read and a write). */
  beforeBatch: (() => void) | null;
}

export function fakeD1(): FakeD1 {
  const state = { changes: 0 };
  const key = (c: Val | undefined, id: Val | undefined) => `${c}\n${id}`;
  const db: FakeD1 = {
    docs: new Map(),
    deletions: new Map(),
    beforeBatch: null,
    prepare(sql) {
      const s = sql.replace(/\s+/g, " ").trim();
      let args: Val[] = [];
      const exec = (): unknown[] => {
        const [a, b, c, d, e] = args;
        if (
          s.startsWith(
            "SELECT c, id, data, at, v FROM docs WHERE c = ? AND id = ?",
          )
        ) {
          const r = db.docs.get(key(a, b));
          return r ? [{ ...r }] : [];
        }
        if (
          s.startsWith(
            "SELECT c, id, data, at, v FROM docs WHERE c = ? ORDER BY id",
          )
        )
          return [...db.docs.values()]
            .filter((r) => r.c === a)
            .sort((x, y) => (x.id < y.id ? -1 : x.id > y.id ? 1 : 0));
        if (s.startsWith("SELECT c, id, at FROM deletions WHERE c = ?"))
          return [...db.deletions.values()].filter((r) => r.c === a);
        if (s.startsWith("SELECT c, id, data, at, v FROM docs WHERE at > ?"))
          return [...db.docs.values()]
            .filter((r) => r.at > (a as number))
            .map((r) => ({ ...r }));
        if (s.startsWith("INSERT INTO docs")) {
          if (db.docs.has(key(a, b)))
            throw new Error("UNIQUE constraint failed: docs.c, docs.id");
          db.docs.set(key(a, b), {
            c: a as string,
            id: b as string,
            data: c as string,
            at: d as number,
            v: 1,
          });
          state.changes = 1;
          return [];
        }
        if (s.startsWith("UPDATE docs SET data = ?, at = ?, v = v + 1")) {
          const r = db.docs.get(key(c, d));
          state.changes = r && r.v === e ? 1 : 0;
          if (r && r.v === e) Object.assign(r, { data: a, at: b, v: r.v + 1 });
          return [];
        }
        if (
          s.startsWith("SELECT CASE WHEN changes() = 0 THEN json('stale') END")
        ) {
          if (state.changes === 0) throw new Error("malformed JSON");
          return [];
        }
        if (s.startsWith("INSERT INTO deletions")) {
          db.deletions.set(key(a, b), {
            c: a as string,
            id: b as string,
            at: c as number,
          });
          state.changes = 1;
          return [];
        }
        throw new Error(`fake D1 does not know: ${s}`);
      };
      const st: D1Statement & { exec: () => unknown[] } = {
        exec,
        bind(...v) {
          args = v;
          return st;
        },
        async first<T>() {
          return (exec()[0] ?? null) as T | null;
        },
        async all<T>() {
          return { results: exec() as T[] };
        },
        async run() {
          exec();
          return { meta: { changes: state.changes } };
        },
      };
      return st;
    },
    async batch(statements) {
      db.beforeBatch?.();
      db.beforeBatch = null;
      const docs = new Map([...db.docs].map(([k, r]) => [k, { ...r }]));
      const dels = new Map(db.deletions);
      try {
        return statements.map((s) =>
          (s as unknown as { exec: () => unknown[] }).exec(),
        );
      } catch (e) {
        db.docs = docs;
        db.deletions = dels;
        throw e;
      }
    },
  };
  return db;
}
