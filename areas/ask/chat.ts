import { clockTime } from "../../domain/index.ts";
import { api, call } from "../../commands/client.ts";
import type { AskMessage } from "./types.ts";

/** One saved line of GET /api/v1/ask/chat (server/ask-chat.ts), restated: areas never import the server. */
interface WireLine {
  id: string;
  role: string;
  text: string;
  at?: string;
}

export interface SavedChat {
  chatId: string | null;
  messages: AskMessage[];
}

const clockOf = (at?: string): string => {
  const d = at ? new Date(at) : null;
  return d && !Number.isNaN(d.getTime()) ? clockTime(d) : "";
};

/** The saved chat, oldest first, with the server's line ids; empty when nothing is saved or the read fails. */
export async function loadChat(
  token: string,
  chatId?: string,
): Promise<SavedChat> {
  const none: SavedChat = { chatId: chatId ?? null, messages: [] };
  try {
    const r = await api(
      `ask/chat${chatId ? `?chat_id=${encodeURIComponent(chatId)}` : ""}`,
      token,
    );
    if (!r.ok) return none;
    const b = (await r.json()) as {
      chatId?: string | null;
      lines?: WireLine[];
    };
    if (!Array.isArray(b.lines)) return none;
    return {
      chatId: b.chatId ?? chatId ?? null,
      messages: b.lines.map((l) =>
        l.role === "user"
          ? { id: l.id, from: "you", at: clockOf(l.at), text: l.text }
          : { id: l.id, from: "ev", text: l.text },
      ),
    };
  } catch {
    return none;
  }
}

/** "Just tell me" about the saved turn `id`: one command (ask.just_tell_me); true once the server took it. */
export async function tellMe(token: string, id: string): Promise<boolean> {
  const r = await call("ask.just_tell_me", { id }, token);
  return r.ok;
}
