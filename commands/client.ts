// generated, do not edit: node ops/generate/cli.ts

export type CommandName = "item.open" | "item.pin" | "item.unpin" | "item.move" | "item.delete" | "item.restore" | "item.rename" | "collection.create" | "collection.new_here" | "note.create" | "note.save" | "note.move" | "session.start" | "session.pause" | "session.end" | "check.answer" | "check.just_tell_me" | "job.stop" | "job.retry_shorter" | "job.dismiss" | "job_status" | "ask.send" | "ask.just_tell_me" | "plan.create" | "plan.update" | "plan.toggle_done" | "plan.move_tomorrow" | "plan.start" | "plan.start_next" | "proposal.accept" | "proposal.edit" | "proposal.dismiss" | "draft.keep" | "draft.drop" | "draft.keep_all" | "draft.drop_all" | "date.create" | "date.update" | "date.plan_with_ev" | "studyplan.approve" | "studyplan.ask_changes" | "studyplan.put_away" | "weakspot.drill" | "weakspot.mark_learned" | "weakspot.confirm" | "weakspot.decline" | "weeklyreview.done" | "set.create" | "set.update" | "set.item_add" | "set.item_update" | "set.item_delete" | "set.done" | "set.write_with_ev" | "set.unverified_keep" | "set.unverified_drop" | "set.save" | "study.start" | "study.attempt" | "study.reveal" | "study.just_tell_me" | "study.leave" | "morning" | "evening" | "weekly_review" | "export" | "restore_drill" | "push_summary" | "canvas_sync" | "palette.open" | "palette.to_ev" | "theme.toggle" | "nav.go";

export const commandNames: readonly CommandName[] = ["item.open", "item.pin", "item.unpin", "item.move", "item.delete", "item.restore", "item.rename", "collection.create", "collection.new_here", "note.create", "note.save", "note.move", "session.start", "session.pause", "session.end", "check.answer", "check.just_tell_me", "job.stop", "job.retry_shorter", "job.dismiss", "job_status", "ask.send", "ask.just_tell_me", "plan.create", "plan.update", "plan.toggle_done", "plan.move_tomorrow", "plan.start", "plan.start_next", "proposal.accept", "proposal.edit", "proposal.dismiss", "draft.keep", "draft.drop", "draft.keep_all", "draft.drop_all", "date.create", "date.update", "date.plan_with_ev", "studyplan.approve", "studyplan.ask_changes", "studyplan.put_away", "weakspot.drill", "weakspot.mark_learned", "weakspot.confirm", "weakspot.decline", "weeklyreview.done", "set.create", "set.update", "set.item_add", "set.item_update", "set.item_delete", "set.done", "set.write_with_ev", "set.unverified_keep", "set.unverified_drop", "set.save", "study.start", "study.attempt", "study.reveal", "study.just_tell_me", "study.leave", "morning", "evening", "weekly_review", "export", "restore_drill", "push_summary", "canvas_sync", "palette.open", "palette.to_ev", "theme.toggle", "nav.go"];

// The one door from the screens to the server (CONTRACT §cmd.registry, §drift.imports): areas and the shell call
// commands and read the API here, never with a raw fetch of their own.
export interface ApiOptions {
  method?: string;
  body?: unknown;
}

/** An /api/v1 request with the app token Matt keeps in this browser. `path` is relative to /api/v1. */
export function api(path: string, token: string, o: ApiOptions = {}): Promise<Response> {
  const headers: Record<string, string> = { authorization: `Bearer ${token}` };
  if (o.body !== undefined) headers["content-type"] = "application/json";
  return fetch(`/api/v1/${path}`, {
    method: o.method ?? (o.body === undefined ? "GET" : "POST"),
    headers,
    ...(o.body === undefined ? {} : { body: JSON.stringify(o.body) }),
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

/** Job helpers: the activity list, one job, and answering a job that needs you. */
export const jobApi = {
  list: (token: string) => api("jobs", token),
  get: (id: string, token: string) => api(`jobs/${encodeURIComponent(id)}`, token),
  answer: (id: string, answer: unknown, token: string) => api(`jobs/${encodeURIComponent(id)}/continue`, token, { body: { answer } }),
};
