import { clockTime } from "../../domain/index.ts";
import { useEffect, useState } from "react";
import { api, failureSentence, readToken } from "../../commands/client.ts";
import { logTellMe } from "./tellLog.ts";
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
}

let turns = 0;

/** The palette's Tab sends /ask?text=<query>; it prefills the input and never sends. */
const readDraft = (): string => {
  try {
    return new URLSearchParams(window.location.search).get("text") ?? "";
  } catch {
    return "";
  }
};

async function askServer(
  token: string,
  text: string,
): Promise<Omit<Extract<AskMessage, { from: "ev" }>, "id">> {
  try {
    const r = await api("ask", token, { body: { text } });
    // Never the server's own text: a refused or failed reply reads as the client's plain sentence.
    if (!r.ok) return { from: "ev", text: failureSentence(r.status) };
    const b = (await r.json()) as { reply?: WireReply };
    if (!b.reply) return { from: "ev", text: failureSentence("server") };
    const { reply } = b;
    return {
      from: "ev",
      text: reply.unverified ? `Unverified: ${reply.text}` : reply.text,
      ...(reply.source ? { source: reply.source } : {}),
      ...(reply.asksTry ? { asksTry: true } : {}),
    };
  } catch (e) {
    return { from: "ev", text: failureSentence(e) };
  }
}

/** The mounted view. Unfinished jobs from /api/v1/jobs show as turns that link to Activity; typed messages stay local. */
export function AskScreen({
  services,
  onToast,
}: {
  services?: { readCopy?: ReadCopyLike };
  onToast?: (message: string) => void;
}) {
  const [sent, setSent] = useState<AskMessage[]>([]);
  const [told, setTold] = useState<readonly string[]>([]);
  const [failed, setFailed] = useState(false);
  const jobs = useAskJobs(services?.readCopy);
  const [draft] = useState(readDraft);
  useEffect(() => {
    if (failed)
      onToast?.(
        "That tap could not be logged, so the answer stays hidden. Try again.",
      );
  }, [failed, onToast]);
  // The tap is logged first (one append-only talk message); only then does the answer show (§ui.attempt-first).
  const onJustTell = (id: string) => {
    void logTellMe(readToken(), id).then(
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
      messages={[...jobTurns, ...sent].map(reveal)}
      onJustTell={onJustTell}
      initialDraft={draft}
      onSend={(text) => {
        const n = ++turns;
        setSent((m) => [
          ...m,
          { id: `m${n}-you`, from: "you", at: clock(), text },
        ]);
        const token = readToken();
        const reply = askServer(token, text);
        void reply.then((r) =>
          setSent((m) => [...m, { id: `m${n}-ev`, ...r }]),
        );
      }}
      onOpenJob={() => window.location.assign("/activity")}
    />
  );
}
