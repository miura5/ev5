import { useState } from "react";
import { api } from "../../commands/client.ts";
import { logTellMe } from "./tellLog.ts";
import { AskView } from "./Ask.view.tsx";
import type { AskMessage } from "./types.ts";
import { useAskJobs, type ReadCopyLike } from "./useAskJobs.ts";

const readToken = (): string => {
  try {
    return localStorage.getItem("ev5.token") ?? "";
  } catch {
    return "";
  }
};

const clock = () =>
  new Date()
    .toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      timeZone: "America/Chicago",
    })
    .toLowerCase();

/** Shown when there is no token yet: the chat needs the same token Activity uses. */
export const NO_TOKEN =
  "I need your token to answer. Paste it in Activity first. Your note stays on screen.";

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

async function askServer(token: string, text: string): Promise<Omit<Extract<AskMessage, { from: "ev" }>, "id">> {
  try {
    const r = await api("ask", token, { body: { text } });
    const b = (await r.json()) as { reply?: WireReply; error?: string };
    if (!r.ok || !b.reply) return { from: "ev", text: b.error ?? "I could not answer that. Try again." };
    const { reply } = b;
    return {
      from: "ev",
      text: reply.unverified ? `Unverified: ${reply.text}` : reply.text,
      ...(reply.source ? { source: reply.source } : {}),
      ...(reply.asksTry ? { asksTry: true } : {}),
    };
  } catch {
    return { from: "ev", text: "I could not reach the server. Try again." };
  }
}

/** The mounted view. Unfinished jobs from /api/v1/jobs show as turns that link to Activity; typed messages stay local. */
export function AskScreen({ services }: { services?: { readCopy?: ReadCopyLike } }) {
  const [sent, setSent] = useState<AskMessage[]>([]);
  const [told, setTold] = useState<readonly string[]>([]);
  const [failed, setFailed] = useState(false);
  const jobs = useAskJobs(services?.readCopy);
  const [draft] = useState(readDraft);
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
      notice={
        failed
          ? "That tap could not be logged, so the answer stays hidden. Try again."
          : undefined
      }
      onSend={(text) => {
        const n = ++turns;
        setSent((m) => [...m, { id: `m${n}-you`, from: "you", at: clock(), text }]);
        const token = readToken();
        const reply = token ? askServer(token, text) : Promise.resolve({ from: "ev" as const, text: NO_TOKEN });
        void reply.then((r) => setSent((m) => [...m, { id: `m${n}-ev`, ...r }]));
      }}
      onOpenJob={() => window.location.assign("/activity")}
    />
  );
}
