import { api } from "../../commands/client.ts";
import { centralDate } from "../../domain/index.ts";

const pad = (n: number) => String(n).padStart(2, "0");
const letters = (r: string) => r.toLowerCase().replace(/[^a-z]/g, "") || "x";

/** The key of a talk message: m-<time>-<by>, letters only after the time (ev4 talk schema 4). */
export function talkKey(now: Date, rand: string): string {
  const d = now;
  const stamp = `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}-${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}`;
  return `m-${stamp}-page${letters(rand)}`;
}

type Raw = Record<string, unknown>;

/** Today's talk document with one more message: his "just tell me" about the E.V. turn `replyTo`. Append-only. */
export function withTellMe(
  prev: Raw | null,
  replyTo: string,
  now: Date,
  rand: string,
): Raw {
  const iso = now.toISOString();
  const base: Raw = prev ?? {
    schema: 4,
    writer: "page",
    at: iso,
    source: "v5/ask",
    date: centralDate(now),
    messages: {},
  };
  const messages = (base.messages ?? {}) as Raw;
  return {
    ...base,
    messages: {
      ...messages,
      [talkKey(now, rand)]: {
        role: "matt",
        text: "Just tell me",
        at: iso,
        replyTo,
      },
    },
  };
}

/** Writes the event into today's talk document, pinned to the version read; one retry when it moved. True once saved. */
export async function logTellMe(
  token: string,
  replyTo: string,
  now = new Date(),
  rand = Math.random().toString(36),
): Promise<boolean> {
  const id = centralDate(now);
  for (let tries = 0; tries < 2; tries++) {
    const got = await api(`docs?collection=talk&id=${id}`, token);
    if (got.status !== 200 && got.status !== 404) return false;
    const cur =
      got.status === 200
        ? ((await got.json()) as { v?: number; data: Raw })
        : null;
    const q = new URLSearchParams({ collection: "talk", id });
    if (cur?.v !== undefined) q.set("if_version", String(cur.v));
    const put = await api(`docs?${q}`, token, {
      method: "PUT",
      body: withTellMe(cur?.data ?? null, replyTo, now, rand),
    });
    if (put.ok) return true;
    if (put.status !== 409) return false;
  }
  return false;
}
