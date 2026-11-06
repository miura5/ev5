// The one writer of talk rows (§data.tables, §data.gate, §data.append-only): every line said in an Ask E.V. chat or a session
// check-in is one appended `talk` row. Nothing is rewritten, summarised or deleted; a chat is the rows that share a chat_id.
import type { TalkRow } from "../../domain/index.ts";
import type { D1Like } from "../docs/d1.ts";
import type { TablesOptions } from "./core.ts";
import { kindsRepo, type Fields } from "./kinds.ts";

const inOrder = (a: TalkRow, b: TalkRow) =>
  a.at - b.at || a.id.localeCompare(b.id);

export function talkRepo(db: D1Like, opts: TablesOptions) {
  const k = kindsRepo(db, opts);
  return {
    talkBook: {
      /** Appends one line through the gate. A repeated id is a conflict (false): the line is never doubled. */
      say: async (line: Fields<TalkRow>): Promise<boolean> =>
        (await k.talk.add(line)).ok,
      /** The lines of one chat in time order; with `last`, only the newest that many. */
      chat: async (chatId: string, last?: number): Promise<TalkRow[]> => {
        const rows = (await k.talk.list({ where: { chat_id: chatId } })).sort(
          inOrder,
        );
        return last === undefined ? rows : rows.slice(-Math.max(0, last));
      },
      /** The chat of the newest Ask E.V. line, or null before the first one. */
      latestAskChat: async (): Promise<string | null> => {
        const r = await db
          .prepare(
            "SELECT chat_id FROM talk WHERE scope = 'ask' ORDER BY at DESC, id DESC LIMIT 1",
          )
          .first<{ chat_id: string }>();
        return r ? r.chat_id : null;
      },
      /** One line by id, or null. */
      line: (id: string) => k.talk.get(id),
    },
  };
}
