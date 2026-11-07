import { describe, expect, test } from 'vitest';
import { createOutbox, memoryStore, type Transport } from './index.ts';

/** A record that takes each attempt once (a repeat is a 409) and can be switched offline. */
function fakeServer() {
  const taken = new Set<string>();
  const s = {
    online: true,
    taken,
    transport: {
      async command(name, input) {
        if (!s.online) throw new Error('offline');
        const key = `${name}/${(input as { attempt: string }).attempt}`;
        if (taken.has(key)) return { status: 409 };
        taken.add(key);
        return { status: 200 };
      },
      async get() {
        return { status: 404 };
      },
    } satisfies Transport,
  };
  return s;
}

const setup = () => {
  const server = fakeServer();
  const win = new EventTarget();
  const doc = Object.assign(new EventTarget(), {
    visibilityState: 'hidden',
  }) as unknown as Document & {
    visibilityState: string;
  };
  const box = createOutbox({
    store: memoryStore(),
    transport: server.transport,
    events: { window: win, document: doc },
  });
  const queue = (attempt: string) =>
    box.queueCommand('study.attempt', attempt, {
      id: 's/i',
      answer: 'a',
      attempt,
    });
  return { server, win, doc, box, queue };
};
const settle = () => new Promise((r) => setTimeout(r, 20));

describe('replay without a save', () => {
  test('an answer queued offline is sent on online, with no other save', async () => {
    const { server, win, box, queue } = setup();
    server.online = false;
    await queue('att_x');
    expect((await box.replay()).stopped).toBe('offline');
    server.online = true;
    win.dispatchEvent(new Event('online'));
    await settle();
    expect(await box.count()).toBe(0);
    expect(server.taken.has('study.attempt/att_x')).toBe(true);
  });

  test('a tab that shows again sends it, a hidden tab does not, and close stops listening', async () => {
    const { server, win, doc, box, queue } = setup();
    await queue('att_y');
    doc.dispatchEvent(new Event('visibilitychange'));
    await settle();
    expect(await box.count()).toBe(1);
    doc.visibilityState = 'visible';
    doc.dispatchEvent(new Event('visibilitychange'));
    await settle();
    expect(await box.count()).toBe(0);
    box.close();
    await queue('att_z');
    win.dispatchEvent(new Event('online'));
    await settle();
    expect(await box.count()).toBe(1);
    expect(server.taken.has('study.attempt/att_z')).toBe(false);
  });
});
