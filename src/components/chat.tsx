import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Bot, Inbox, Loader2, MessageSquare, Send, Sparkles, Trash2, X } from "lucide-react";
import type { Filters } from "../lib";
import { Badge, Card, Empty } from "./ui";

type Msg = { role: "user" | "assistant"; content: string; meta?: string; escalated?: boolean };
const SUGGEST = ["Which POCs are cold?", "What's overdue?", "Summarise Hoichoi", "Which demos have been pending longest?", "What are the top blocker themes?"];
const KEY = "pd_chat";

export function ChatWidget({ filters, hasFilters }: { filters: Filters; hasFilters: boolean }) {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>(() => { try { return JSON.parse(sessionStorage.getItem(KEY) ?? "[]"); } catch { return []; } });
  const [input, setInput] = useState(""); const [busy, setBusy] = useState(false); const [useFilters, setUseFilters] = useState(true);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { sessionStorage.setItem(KEY, JSON.stringify(msgs)); end.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, open]);

  const send = async (text: string) => {
    const q = text.trim(); if (!q || busy) return;
    const next: Msg[] = [...msgs, { role: "user", content: q }]; setMsgs(next); setInput(""); setBusy(true);
    try {
      const r = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: next.map(({ role, content }) => ({ role, content })), filters, useFilters: useFilters && hasFilters }) });
      const j = await r.json();
      setMsgs([...next, r.ok ? { role: "assistant", content: j.answer, meta: j.model, escalated: !!j.escalatedId } : { role: "assistant", content: `⚠️ ${j.error ?? "Request failed"}` }]);
    } catch (e) { setMsgs([...next, { role: "assistant", content: `⚠️ ${(e as Error).message}` }]); } finally { setBusy(false); }
  };
  const escalate = async () => {
    const lastQ = [...msgs].reverse().find(m => m.role === "user")?.content ?? input.trim(); if (!lastQ) return;
    await fetch("/api/escalate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question: lastQ, context: "Check Gmail/Calendar" }) });
    setMsgs(m => [...m, { role: "assistant", content: `📨 Sent to **CREATOR** to check Gmail/Calendar: _"${lastQ}"_. The answer will appear in the **Ask CREATOR** inbox.`, escalated: true }]);
  };

  return (<>
    <button onClick={() => setOpen(o => !o)} aria-label="Open AI chat" className="fixed bottom-5 right-5 z-40 grid h-14 w-14 place-items-center rounded-full bg-gradient-to-br from-sky-500 to-indigo-600 text-white shadow-xl shadow-sky-500/30 transition hover:scale-105">{open ? <X size={22} /> : <MessageSquare size={22} />}</button>
    {open && <div className="fixed bottom-24 right-5 z-40 flex h-[min(640px,80vh)] w-[min(420px,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between border-b border-slate-200 bg-gradient-to-r from-sky-500/10 to-indigo-500/10 px-4 py-3 dark:border-slate-800">
        <div className="flex items-center gap-2"><Sparkles size={16} className="text-sky-500" /><div><div className="text-sm font-semibold">Ask the tracker</div><div className="text-[11px] muted">Answers only from your presales data</div></div></div>
        <button onClick={() => setMsgs([])} title="Clear chat" className="rounded p-1.5 muted hover:bg-slate-100 dark:hover:bg-slate-800"><Trash2 size={14} /></button>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto p-4 text-sm">
        {!msgs.length && <div><p className="mb-3 muted">Ask anything about deals, demos, meetings, prep or F2F.</p><div className="flex flex-wrap gap-2">{SUGGEST.map(s => <button key={s} onClick={() => send(s)} className="rounded-full border border-slate-200 px-3 py-1 text-xs hover:border-sky-500 hover:text-sky-500 dark:border-slate-700">{s}</button>)}</div></div>}
        {msgs.map((m, i) => <div key={i} className={`flex ${m.role === "user" ? "justify-end" : ""}`}>
          <div className={`max-w-[88%] rounded-2xl px-3 py-2 ${m.role === "user" ? "bg-sky-500 text-white" : "bg-slate-100 dark:bg-slate-800"}`}>
            {m.role === "assistant" ? <div className="prose-chat"><ReactMarkdown>{m.content}</ReactMarkdown></div> : m.content}
            {m.escalated && m.meta && <div className="mt-1 text-[11px] text-amber-600 dark:text-amber-400">Not in the data, so it was added to the Ask CREATOR inbox.</div>}
            {m.meta && <div className="mt-1 text-[10px] muted">{m.meta}</div>}
          </div></div>)}
        {busy && <div className="flex items-center gap-2 text-xs muted"><Loader2 size={14} className="animate-spin" />Thinking…</div>}
        <div ref={end} />
      </div>
      <div className="border-t border-slate-200 p-3 dark:border-slate-800">
        <div className="mb-2 flex items-center justify-between text-[11px]">
          <label className={`flex items-center gap-1.5 ${hasFilters ? "" : "opacity-50"}`}><input type="checkbox" disabled={!hasFilters} checked={useFilters && hasFilters} onChange={e => setUseFilters(e.target.checked)} />Use active filters</label>
          <button onClick={escalate} disabled={!msgs.length && !input.trim()} className="flex items-center gap-1 text-sky-600 hover:underline disabled:opacity-40 dark:text-sky-400"><Bot size={12} />Ask CREATOR to check Gmail/Calendar</button>
        </div>
        <form onSubmit={e => { e.preventDefault(); send(input); }} className="flex gap-2"><input value={input} onChange={e => setInput(e.target.value)} placeholder="e.g. What's overdue this week?" className="select flex-1" /><button disabled={busy || !input.trim()} className="grid h-9 w-9 place-items-center rounded-lg bg-sky-500 text-white disabled:opacity-40"><Send size={15} /></button></form>
      </div>
    </div>}
  </>);
}

type Q = { id: string; question: string; context?: string; reason: string; status: string; createdAt: string; answer?: string; answeredAt?: string; answeredBy?: string };
export function CreatorInbox() {
  const [qs, setQs] = useState<Q[] | null>(null);
  const load = () => fetch("/api/inbox").then(r => r.json()).then(setQs).catch(() => setQs([]));
  useEffect(() => { load(); const t = setInterval(load, 30_000); return () => clearInterval(t); }, []);
  const fmt = (s?: string) => s ? new Date(s).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" }) + " IST" : "";
  if (!qs) return <div className="card h-40 animate-pulse" />;
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card title="Ask CREATOR" subtitle="Questions the data couldn't answer, sent to CREATOR to check Gmail / Calendar" className="lg:col-span-2" right={<Inbox size={16} className="muted" />}>
        {qs.length ? <ul className="space-y-3">{qs.map(q => <li key={q.id} className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
          <div className="flex items-start justify-between gap-3"><div className="font-medium">{q.question}</div><Badge tone={q.status === "answered" ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : "bg-amber-500/15 text-amber-600 dark:text-amber-400"}>{q.status}</Badge></div>
          <div className="mt-1 text-[11px] muted">{fmt(q.createdAt)} · {q.reason === "user-request" ? "you asked CREATOR" : "auto-escalated (not in data)"}{q.context ? ` · ${q.context}` : ""}</div>
          {q.answer ? <div className="mt-3 rounded-lg bg-sky-500/5 p-3 text-sm"><div className="mb-1 flex items-center gap-1 text-[11px] font-semibold text-sky-600 dark:text-sky-400"><Bot size={12} />{q.answeredBy} · {fmt(q.answeredAt)}</div><div className="prose-chat"><ReactMarkdown>{q.answer}</ReactMarkdown></div></div> : <div className="mt-3 text-xs italic muted">Waiting for CREATOR…</div>}
        </li>)}</ul> : <Empty text="No escalated questions yet. Use the chat button at the bottom right." />}
      </Card>
      <Card title="How it works"><ul className="list-disc space-y-2 pl-4 text-sm muted">
        <li>The chat answers only from the tracker data.</li><li>If the answer isn't in the data, the question is queued here automatically.</li>
        <li>You can also click <b>Ask CREATOR to check Gmail/Calendar</b> in the chat.</li><li>CREATOR picks up open questions and posts answers back here.</li></ul>
        <div className="mt-4 flex gap-3 text-sm"><span><b>{qs.filter(q => q.status === "open").length}</b> open</span><span><b>{qs.filter(q => q.status === "answered").length}</b> answered</span></div></Card>
    </div>
  );
}
