// The checks every command file shares: its commands are well formed and E.V. is held to §cmd.propose.
import { expect, test } from 'vitest';
import type { Command } from './define.ts';
import { resolveCall } from './define.ts';

export function testGroup(group: readonly Command[]): void {
  test('every command has a unique name and a caller', () => {
    expect(group.length).toBeGreaterThan(0);
    expect(new Set(group.map(c => c.name)).size).toBe(group.length);
    for (const c of group) expect(Object.keys(c.callers).length, c.name).toBeGreaterThan(0);
  });
  test('E.V. never changes the plan directly', () => {
    for (const c of group.filter(c => c.callers.ev && c.changesPlan)) expect(c.callers.ev, c.name).toBe('propose');
  });
  test('a caller not listed is refused', () => {
    for (const c of group) {
      const unlisted = (['matt', 'ev', 'schedule', 'external'] as const).find(k => !c.callers[k])!;
      expect(resolveCall(c, unlisted, {}).ok, c.name).toBe(false);
    }
  });
}
