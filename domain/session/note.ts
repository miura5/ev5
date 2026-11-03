import { hash } from './stamp.ts';
import { SESSION_RULES, type SessionRules } from './types.ts';

/** What a note's text is reduced to in the record: its length and hash. */
export function noteMark(text: string | null | undefined): { len: number; h: string } {
  const t = String(text ?? '');
  return { len: t.length, h: hash(t) };
}

/** The writing since the last mark: `same` = nothing new; `rewritten` = the old text changed, so only the end is used. */
export function noteDelta(
  text: string | null | undefined,
  mark: { len?: number; h?: string } | null,
  rules: SessionRules = SESSION_RULES
): { added: string; same: boolean; rewritten: boolean; fresh?: true } {
  const t = String(text ?? '');
  if (!mark || mark.len == null) return { added: t.slice(-rules.fallbackChars), same: false, rewritten: false, fresh: true };
  if (t.length === mark.len && hash(t) === mark.h) return { added: '', same: true, rewritten: false };
  if (t.length >= mark.len && hash(t.slice(0, mark.len)) === mark.h) {
    const added = t.slice(mark.len);
    return { added, same: !added.trim(), rewritten: false };
  }
  return { added: t.slice(-rules.fallbackChars), same: false, rewritten: true };
}

export type ReadAlong =
  | { ask: false; why: 'first'; seen: string }
  | { ask: false; why: 'same' | 'idle' | 'small' | 'soon' }
  | { ask: true; added: string; before: string; seenNext: string };

/**
 * Whether a read-along read goes now, from what the page last read (`seen`), the note's text now, whether he is still
 * typing (then complete lines only), when it last changed and when the last read went. First: what is written when
 * reading starts counts as read. Same: never a second read of the same text. Idle: nothing written for
 * readAlongIdleMinutes. Small: under commentMinChars of new text. Soon: within commentGapSeconds of the last read.
 */
export function readAlongAsk(
  i: { text: string; seen: string | null; typing?: boolean; changedAt?: number; lastAsk?: number; now?: number },
  rules: SessionRules = SESSION_RULES
): ReadAlong {
  const { text: t, seen, typing = false, changedAt = 0, lastAsk = 0, now = Date.now() } = i;
  if (seen == null) return { ask: false, why: 'first', seen: t };
  if (t === seen) return { ask: false, why: 'same' };
  if (now - changedAt >= rules.readAlongIdleMinutes * 60e3) return { ask: false, why: 'idle' };
  const grew = t.startsWith(seen);
  let added = grew ? t.slice(seen.length) : t.slice(-1200);
  if (typing) {
    const k = added.lastIndexOf('\n');
    added = k >= 0 ? added.slice(0, k + 1) : '';
  }
  if (added.replace(/\s/g, '').length < rules.commentMinChars) return { ask: false, why: 'small' };
  if (now - lastAsk < rules.commentGapSeconds * 1e3) return { ask: false, why: 'soon' };
  return { ask: true, added, before: grew ? seen.slice(-800) : '', seenNext: grew ? seen + added : t };
}
