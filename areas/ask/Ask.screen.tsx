import { clockTime } from "../../domain/index.ts";
import { useEffect, useState } from "react";
import { call, failureSentence, readToken } from "../../commands/client.ts";
import { loadChat, tellMe } from "./chat.ts";
import { AskView } from "./Ask.view.tsx";
import type { AskMessage } from "./types.ts";
import { useAskJobs, type ReadCopyLike } from "./useAskJobs.ts";

const clock = () => clockTime(new Date());

/** The reply the server sends from POST /api/v1/ask (server/ask-chat.ts); restated, areas never import the server. */
interface WireReply {
  text: string;
  source?: string;
  unverified: boolean;
  asksTry: boolean;
  chatId?: string;
}

let turns = 0;

/** The palette's Tab sends /ask?text=<query>; it prefills the input and never sends. */
const readDraft = (search = ""): string =>
  new URLSearchParams(search).get("text") ?? "";

async function askServer(
  token: string,
  text: string,
  chatId: string | null,
): Promise<
  Omit<Extract<AskMessage, { from: "ev" }>, "id"> & { chatId?: string }
> {
  try {
    const r = await call(
      "ask.send",
      chatId ? { text, chat_id: chatId } : { text },
      token,
    );
    // Never the server's own text: a refused or failed reply reads as the client's plain sentence.
    if (!r.ok) return { from: "ev", text: r.reason };
    const b = (r.result ?? {}) as { reply?: WireReply };
    if (!b.reply) return { from: "ev", text: failureSentence("server") };
    const { reply } = b;
    return {
      from: "ev",
      text: reply.unverified ? `Unverified: ${reply.text}` : reply.text,
      ...(reply.source ? { source: reply.source } : {}),
      ...(reply.asksTry ? { asksTry: true } : {}),
      ...(reply.chatId ? { chatId: reply.chatId } : {}),
    };
  } catch (e) {
    return { from: "ev", text: failureSentence(e) };
  }
}

/** The mounted view. Unfinished jobs from /api/v1/jobs show as turns that link to Activity; typed messages stay local. */
export function AskScreen({
  services,
  search,
  onNavigate,
  onToast,
}: {
  services?: { readCopy?: ReadCopyLike };
  search?: string;
  onNavigate?: (path: string) => void;
  onToast?: (message: string) => void;
}) {
  const [sent, setSent] = useState<AskMessage[]>([]);
  const [told, setTold] = useState<readonly string[]>([]);
  const [failed, setFailed] = useState(false);
  const [saved, setSaved] = useState<AskMessage[]>([]);
  const [chatId, setChatId] = useState<string | null>(null);
  // A reload keeps the chat: the newest saved conversation comes back from the server.
  useEffect(() => {
    let live = true;
    const token = readToken();
    if (!token) return;
    void loadChat(token).then((c) => {
      if (!live) return;
      setSaved(c.messages);
      setChatId((cur) => cur ?? c.chatId);
    });
    return () => {
      live = false;
    };
  }, []);
  const jobs = useAskJobs(services?.readCopy);
  const [draft] = useState(() => readDraft(search));
  useEffect(() => {
    if (failed)
      onToast?.(
        "That tap could not be logged, so the answer stays hidden. Try again.",
      );
  }, [failed, onToast]);
  // The tap is logged first (one append-only talk message); only then does the answer show (§ui.attempt-first).
  const onJustTell = (id: string) => {
    void tellMe(readToken(), id).then(
      (ok) =>
        ok ? (setFailed(false), setTold((t) => [...t, id])) : setFailed(true),
      () => setFailed(true),
    );
  };
  const reveal = (m: AskMessage): AskMessage =>
    m.from === "ev" && told.includes(m.id)
      ? { ...m, asksTry: false, text: m.answer ?? m.text }
      : m;
  const jobTurns: AskMessage[] = jobs.map((j) => ({
    id: `job-${j.id}`,
    from: "ev",
    text: "This one is still open in Activity.",
    job: j.job,
  }));
  return (
    <AskView
      messages={[...jobTurns, ...saved, ...sent].map(reveal)}
      onJustTell={onJustTell}
      initialDraft={draft}
      onSend={(text) => {
        const n = ++turns;
        setSent((m) => [
          ...m,
          { id: `m${n}-you`, from: "you", at: clock(), text },
        ]);
        const token = readToken();
        void askServer(token, text, chatId).then(async (r) => {
          const { chatId: cid, ...turn } = r;
          if (cid) setChatId(cid);
          // The saved line's id is what "Just tell me" names: read it back once the turn is saved.
          const id = cid ?? chatId;
          const last = id ? (await loadChat(token, id)).messages.at(-1) : null;
          const lineId = last?.from === "ev" ? last.id : `m${n}-ev`;
          setSent((m) => [...m, { id: lineId, ...turn }]);
        });
      }}
      onOpenJob={() => onNavigate?.("/activity")}
    />
  );
}
