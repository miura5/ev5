// generated, do not edit: node ops/generate/cli.ts

export type CommandName = "item.open" | "item.pin" | "item.unpin" | "item.move" | "item.delete" | "item.restore" | "item.rename" | "collection.create" | "collection.new_here" | "note.create" | "note.save" | "note.move" | "session.start" | "session.pause" | "session.end" | "check.answer" | "check.just_tell_me" | "job.stop" | "job.retry_shorter" | "job.dismiss" | "job_status" | "ask.send" | "ask.just_tell_me" | "plan.create" | "plan.update" | "plan.toggle_done" | "plan.move_tomorrow" | "plan.start" | "plan.start_next" | "proposal.accept" | "proposal.edit" | "proposal.dismiss" | "draft.keep" | "draft.drop" | "draft.keep_all" | "draft.drop_all" | "date.create" | "date.update" | "date.plan_with_ev" | "studyplan.approve" | "studyplan.ask_changes" | "studyplan.put_away" | "weakspot.drill" | "weakspot.mark_learned" | "weakspot.confirm" | "weakspot.decline" | "weeklyreview.done" | "set.create" | "set.update" | "set.item_add" | "set.item_update" | "set.item_delete" | "set.done" | "set.write_with_ev" | "set.unverified_keep" | "set.unverified_drop" | "set.save" | "study.start" | "study.attempt" | "study.reveal" | "study.just_tell_me" | "study.leave" | "morning" | "evening" | "weekly_review" | "export" | "restore_drill" | "push_summary" | "job_sweep" | "canvas_sync" | "palette.open" | "palette.to_ev" | "theme.toggle" | "nav.go";

export const commandNames: readonly CommandName[] = ["item.open", "item.pin", "item.unpin", "item.move", "item.delete", "item.restore", "item.rename", "collection.create", "collection.new_here", "note.create", "note.save", "note.move", "session.start", "session.pause", "session.end", "check.answer", "check.just_tell_me", "job.stop", "job.retry_shorter", "job.dismiss", "job_status", "ask.send", "ask.just_tell_me", "plan.create", "plan.update", "plan.toggle_done", "plan.move_tomorrow", "plan.start", "plan.start_next", "proposal.accept", "proposal.edit", "proposal.dismiss", "draft.keep", "draft.drop", "draft.keep_all", "draft.drop_all", "date.create", "date.update", "date.plan_with_ev", "studyplan.approve", "studyplan.ask_changes", "studyplan.put_away", "weakspot.drill", "weakspot.mark_learned", "weakspot.confirm", "weakspot.decline", "weeklyreview.done", "set.create", "set.update", "set.item_add", "set.item_update", "set.item_delete", "set.done", "set.write_with_ev", "set.unverified_keep", "set.unverified_drop", "set.save", "study.start", "study.attempt", "study.reveal", "study.just_tell_me", "study.leave", "morning", "evening", "weekly_review", "export", "restore_drill", "push_summary", "job_sweep", "canvas_sync", "palette.open", "palette.to_ev", "theme.toggle", "nav.go"];

export interface PaletteEntry {
  name: CommandName;
  title: string;
  places?: readonly string[];
}

export const paletteEntries: readonly PaletteEntry[] = [
  {"name":"collection.create","title":"New collection","places":["library","notes"]},
  {"name":"note.create","title":"New note","places":["notes","library"]},
  {"name":"session.start","title":"Start a study session","places":["today","sessions"]},
  {"name":"ask.send","title":"Ask E.V."},
  {"name":"plan.create","title":"Add a plan item","places":["today"]},
  {"name":"date.create","title":"Add a date","places":["today"]},
  {"name":"set.create","title":"New set","places":["library"]},
  {"name":"theme.toggle","title":"Switch light and dark"},
  {"name":"nav.go","title":"Go to a place"},
];

// The one door from the screens to the server (CONTRACT §cmd.registry, §drift.imports): areas and the shell call
// commands and read the API here, never with a raw fetch of their own.
export interface ApiOptions {
  method?: string;
  body?: unknown;
  /** Raw bytes sent as they are (a picture), with their content type; wins over `body`. */
  raw?: { data: Blob | ArrayBuffer; contentType: string };
}

/** An /api/v1 request with the app token Matt keeps in this browser. `path` is relative to /api/v1. */
export function api(path: string, token: string, o: ApiOptions = {}): Promise<Response> {
  const headers: Record<string, string> = { authorization: `Bearer ${token}` };
  const sent = o.raw ? o.raw.data : o.body === undefined ? undefined : JSON.stringify(o.body);
  if (o.raw) headers["content-type"] = o.raw.contentType;
  else if (o.body !== undefined) headers["content-type"] = "application/json";
  return fetch(`/api/v1/${path}`, {
    method: o.method ?? (sent === undefined ? "GET" : "POST"),
    headers,
    ...(sent === undefined ? {} : { body: sent }),
  });
}

/** What the command route answers: a Suggestion for an E.V. propose call, or the handler's result. */
export type CallResult =
  | { ok: true; mode: "direct" | "propose"; suggestion?: { command: string; input: unknown; title: string }; result?: unknown }
  | { ok: false; status: number; reason: string };

/** Call a registry command by name; the server checks the caller and the input (§cmd.propose). */
export async function call(name: CommandName, input: unknown, token: string): Promise<CallResult> {
  const r = await api(`commands/${name}`, token, { body: { input } });
  const b = (await r.json().catch(() => ({}))) as Record<string, unknown>;
  if (!r.ok) return { ok: false, status: r.status, reason: String(b.error ?? "failed") };
  return { ok: true, mode: b.mode as "direct" | "propose", suggestion: b.suggestion as never, result: b.result };
}

/** The shell's saved-copy reader (shell/readCopy.ts), restated: the shell hands it to the areas (§data.offline). */
export interface ReadCopyLike {
  read<T>(key: string, fetcher: () => Promise<T>): Promise<T>;
}

/** A read the server refused (wrong token, server error): never "offline", so it is never kept as the saved copy. */
export class ApiError extends Error {
  constructor(readonly status: number) {
    super(`request failed: ${status}`);
  }
}

/** GET a JSON read. With a saved copy, a rejected fetch (offline) gives back the last good answer; 401 and 5xx throw. */
export function readJson<T>(path: string, token: string, key: string, copy?: ReadCopyLike, pick: (body: unknown) => T = b => b as T): Promise<T> {
  const get = async (): Promise<T> => {
    const r = await api(path, token);
    if (!r.ok) throw new ApiError(r.status);
    return pick(await r.json());
  };
  return copy ? copy.read(key, get) : get();
}

/** Job helpers: the activity list, one job, and answering a job that needs you. */
export const jobApi = {
  /** The unfinished jobs (the `jobs` array of GET /jobs), kept under "jobs". */
  list: (token: string, copy?: ReadCopyLike) =>
    readJson<unknown[]>("jobs", token, "jobs", copy, b => (b as { jobs: unknown[] }).jobs),
  get: (id: string, token: string, copy?: ReadCopyLike) =>
    readJson<unknown>(`jobs/${encodeURIComponent(id)}`, token, `job:${id}`, copy),
  answer: (id: string, answer: unknown, token: string) => api(`jobs/${encodeURIComponent(id)}/continue`, token, { body: { answer } }),
};
