import test from 'node:test';
import assert from 'node:assert/strict';
import { gateProblem } from '../docs/gate.ts';
import { memoryAdapter } from './memory-adapter.ts';
import { PROTOCOL_CASES, registerProtocolSuite, testClock } from './protocol-suite.ts';
import type { ProtocolAdapter } from './protocol.ts';

// The reference adapter passes the whole suite.
registerProtocolSuite('in-memory reference', clock => memoryAdapter({ clock, problem: gateProblem }), test);

// The suite can fail: adapters each with one protocol bug are caught by at least one case.
const broken: Record<string, (clock: () => number) => ProtocolAdapter> = {
  'ignores if_version on a page save': clock => {
    const a = memoryAdapter({ clock, problem: gateProblem });
    return { ...a, save: async (c, id, body) => a.save(c, id, body, (await a.get(c, id))?.v ?? null) };
  },
  'stamps some writes with a clock other than the server clock': clock => {
    let n = 0;
    return memoryAdapter({ clock: () => (n++ % 2 ? clock() : 0), problem: gateProblem });
  },
  'has a delete method': clock => ({ ...memoryAdapter({ clock, problem: gateProblem }), delete: async () => {} }) as ProtocolAdapter,
  'skips the note check': clock => memoryAdapter({ clock, problem: null }),
  'writes a batch entry by entry': clock => {
    const a = memoryAdapter({ clock, problem: gateProblem });
    return {
      ...a,
      batch: async w => {
        const ws = Array.isArray(w) ? w : [];
        let last = await a.batch(ws.slice(0, 1));
        for (const x of ws.slice(1)) last = await a.batch([x]);
        return last;
      },
    };
  },
};

for (const [bug, make] of Object.entries(broken))
  test(`the suite catches an adapter that ${bug}`, async () => {
    let failed = 0;
    for (const c of PROTOCOL_CASES) {
      const clock = testClock();
      try {
        await c.run(make(clock.read), clock);
      } catch {
        failed++;
      }
    }
    assert.ok(failed > 0, `no case failed for an adapter that ${bug}`);
  });
