// S-07 throwaway spike Worker. Deployed only as `ev5-spike`; deleted after the run.
import { WorkflowEntrypoint } from "cloudflare:workers";

// Synthetic structured output of roughly 32k tokens (~128 KB of JSON text).
function synth() {
  const items = [];
  for (let i = 0; i < 160; i++) {
    items.push({ id: `q${i}`, stem: "lorem ipsum dolor sit amet ".repeat(12), choices: ["a", "b", "c", "d"].map((k) => ({ k, text: "consectetur adipiscing elit ".repeat(6) })), answer: "a", cite: [{ doc: "d" + i, span: [0, 10] }] });
  }
  return JSON.stringify({ items });
}
function validate(o) {
  if (!Array.isArray(o.items)) throw new Error("items");
  for (const it of o.items) {
    if (typeof it.id !== "string" || typeof it.stem !== "string" || it.choices.length !== 4) throw new Error("bad item");
    for (const c of it.choices) if (typeof c.k !== "string" || typeof c.text !== "string") throw new Error("bad choice");
    if (!it.cite.every((c) => c.span.length === 2)) throw new Error("bad cite");
  }
  return o.items.length;
}

export class SpikeWorkflow extends WorkflowEntrypoint {
  async run(event, step) {
    const id = event.payload.id;
    await step.do("first", async () => {
      await this.env.DB.prepare("INSERT OR IGNORE INTO marks (k, v) VALUES (?, ?)").bind(`${id}:first`, "1").run();
      return { ok: true };
    });
    if (event.payload.slow) await step.sleep("slow", "20 seconds");
    // Test 1: needs-you ends this instance; the continuation finishes it.
    const got = await step.waitForEvent("needs-you", { type: "answer", timeout: "30 seconds" }).catch(() => null);
    if (!got) {
      await step.do("needs-you", async () => {
        await this.env.DB.prepare("INSERT OR IGNORE INTO marks (k, v) VALUES (?, ?)").bind(`${id}:needs-you`, "1").run();
        return { state: "needs-you" };
      });
      return { ended: "needs-you" };
    }
    await step.do("finish", async () => {
      await this.env.DB.prepare("INSERT OR IGNORE INTO marks (k, v) VALUES (?, ?)").bind(`${id}:finish`, "1").run();
      return { ok: true };
    });
    return { ended: "finished" };
  }
}

export class CpuWorkflow extends WorkflowEntrypoint {
  // Test 4: parse + validate in one step; the limits.cpu_ms setting enforces the Free-tier 10 ms.
  async run(event, step) {
    return step.do("parse-validate", async () => {
      const text = synth();
      return { bytes: text.length, items: validate(JSON.parse(text)) };
    });
  }
}

const j = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json" } });

export default {
  async fetch(req, env) {
    const u = new URL(req.url);
    const id = u.searchParams.get("id") || "t";
    try {
      if (u.pathname === "/init") {
        await env.DB.exec("CREATE TABLE IF NOT EXISTS marks (k TEXT PRIMARY KEY, v TEXT)");
        return j({ ok: true });
      }
      if (u.pathname === "/start") {
        const i = await env.WF.create({ id, params: { id, slow: u.searchParams.has("slow") } });
        return j({ id: i.id });
      }
      if (u.pathname === "/cpu") {
        const i = await env.CPU.create({ id: `${id}-${Date.now()}`, params: {} });
        return j({ id: i.id });
      }
      if (u.pathname === "/status") {
        const w = u.searchParams.get("w") === "cpu" ? env.CPU : env.WF;
        return j(await (await w.get(id)).status());
      }
      if (u.pathname === "/event") {
        await (await env.WF.get(id)).sendEvent({ type: "answer", payload: {} });
        return j({ sent: true });
      }
      if (u.pathname === "/marks") {
        return j((await env.DB.prepare("SELECT k FROM marks ORDER BY k").all()).results);
      }
      return j({ ok: true });
    } catch (e) {
      return j({ error: String(e) }, 500);
    }
  },
};
