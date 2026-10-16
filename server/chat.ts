import type { Dataset } from "../shared/model.js";

export const INSUFFICIENT = "[[INSUFFICIENT_DATA]]";
const trim = (s: string, n = 220) => (s.length > n ? s.slice(0, n) + "…" : s);
const scrub = (s: string) => s.replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[email]"); // never send email addresses to the model
const t = (s: string, n?: number) => trim(scrub(s ?? ""), n);
const drop = (o: Record<string, unknown>) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== "" && v != null));

export function compact(d: Pick<Dataset, "deals" | "demos" | "meetings" | "prep" | "f2f">) {
  return {
    deals: d.deals.map(x => drop({ id: x.id, account: x.account, opp: t(x.opportunity, 80), rep: x.rep, vertical: x.vertical, stage: x.stage, assigned: x.dateAssigned, status: t(x.notes), useCase: t(x.useCase, 160),
      next: t(x.nextSteps), blockers: t(x.blockers, 160), pocOwners: t(x.pocOwners, 120), outcome: x.outcome, outcomeReason: t(x.outcomeReason, 120), pocType: x.pocType, lastTouch: x.lastTouch,
      lastTouchVia: x.lastTouchVia, daysSinceTouch: x.daysSinceTouch, health: x.health, nextDue: x.nextActionDue, nextOwner: x.nextActionOwner, blockerTheme: x.blockerTheme })),
    demos: d.demos.map(x => drop({ client: x.client, type: x.type, useCase: t(x.useCase, 120), requestedBy: x.requestedBy, requested: x.dateRequested, status: x.status, owners: t(x.owners, 100), update: t(x.latestUpdate), delivered: x.deliveredDate, daysPending: x.daysPending })),
    meetings: d.meetings.map(x => drop({ date: x.date, time: x.time, title: t(x.title, 90), client: x.client, status: x.status, summary: t(x.summary, 200), actions: t(x.actions, 200) })),
    prep: d.prep.map(x => drop({ date: x.date, time: x.time, title: t(x.title, 90), client: x.client, brief: t(x.brief, 300) })),
    f2f: d.f2f.map(x => drop({ date: x.date, company: x.company, km: x.km, rate: x.rate, amount: x.amount, status: x.status })),
  };
}

const istToday = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
const SYSTEM = (filters: string) => `You are the Presales Command Center assistant for Puru Chauhan (Manager - Presales, Paytm Pi).
Today is ${istToday()} (IST). Answer ONLY from the JSON dataset provided in this conversation. Do not use outside knowledge or invent facts.
Style: concise markdown, short bullets, cite account names and deal IDs (e.g. "Hoichoi (PURU-043)"). Use dates as "16 Oct".
Health: Active <=10 days since touch, Cooling 11-20, Cold >20, Closed. "Overdue" = nextDue earlier than today.
${filters ? `The user has these dashboard filters active (the dataset is already filtered accordingly): ${filters}.` : ""}
If the dataset does not contain the information needed (e.g. emails, calendar details, pricing not in the data), say so plainly and end your reply with the exact token ${INSUFFICIENT} on its own line.`;

export interface ChatMsg { role: "user" | "assistant"; content: string }

async function call(model: string, key: string, body: unknown) {
  return fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": key }, body: JSON.stringify(body), signal: AbortSignal.timeout(60_000),
  });
}

export async function askGemini(history: ChatMsg[], data: ReturnType<typeof compact>, filters: string) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw Object.assign(new Error("AI chat is not configured (GEMINI_API_KEY missing)"), { status: 503 });
  const contents = [
    { role: "user", parts: [{ text: "DATASET (JSON):\n" + JSON.stringify(data) }] },
    { role: "model", parts: [{ text: "Understood. I will answer only from this dataset." }] },
    ...history.slice(-12).map(m => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content.slice(0, 4000) }] })),
  ];
  const body = { systemInstruction: { parts: [{ text: SYSTEM(filters) }] }, contents, generationConfig: { temperature: 0.2, maxOutputTokens: 2048 } };
  const fallbacks = (process.env.GEMINI_FALLBACK_MODELS || "gemini-2.0-flash,gemini-3.8-flash,gemini-3.5-flash,gemini-flash-latest").split(",").map(m => m.trim()).filter(Boolean);
  const models = [process.env.GEMINI_MODEL || "gemini-2.5-flash", ...fallbacks].filter((m, i, a) => a.indexOf(m) === i);
  let last = "";
  for (const model of models) {
    let r = await call(model, key, body);
    if (r.status === 503 || r.status === 429) { await new Promise(ok => setTimeout(ok, 1500)); r = await call(model, key, body); }
    if (r.status === 404 || r.status === 503 || r.status === 429) { last = `model ${model} unavailable (${r.status})`; console.warn("gemini:", last); continue; }
    if (!r.ok) { const e = await r.json().catch(() => ({})); throw Object.assign(new Error(`Gemini error ${r.status}: ${(e as { error?: { message?: string } }).error?.message ?? "unknown"}`), { status: 502 }); }
    const j = (await r.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    let text = j.candidates?.[0]?.content?.parts?.map(p => p.text ?? "").join("") ?? "";
    const insufficient = text.includes(INSUFFICIENT);
    text = text.replace(INSUFFICIENT, "").trim() || "_No answer returned._";
    return { model, text, insufficient };
  }
  throw Object.assign(new Error(last.includes("429") ? "The AI is at its usage limit right now. Please try again in a minute." : `No Gemini model available (${last})`), { status: last.includes("429") ? 429 : 502 });
}
