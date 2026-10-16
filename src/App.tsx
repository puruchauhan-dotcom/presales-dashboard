import { useCallback, useEffect, useMemo, useState } from "react";
import { HeartPulse, ListTodo, BarChart3, Briefcase, CalendarDays, Database, Lock, LogOut, Moon, MonitorPlay, RefreshCw, ShieldCheck, Sun, Target, Timer, Users, X } from "lucide-react";
import { Kpi } from "./components/ui";
import { Deals, Demos, Meetings, Overview, Quality } from "./components/views";
import { Actions, Health, demoDelivery, isPuruPaid } from "./components/insights";
import { applyFilters, defaultFilters, stageSort, today, uniq, type Dataset, type Filters } from "./lib";

const NAV = [
  { id: "overview", label: "Overview", icon: BarChart3 }, { id: "health", label: "POC health & outcomes", icon: HeartPulse }, { id: "actions", label: "This week & actions", icon: ListTodo },
  { id: "deals", label: "Deal pipeline", icon: Briefcase },
  { id: "demos", label: "Demo pipeline", icon: MonitorPlay }, { id: "meetings", label: "Meetings", icon: CalendarDays }, { id: "quality", label: "Data quality", icon: ShieldCheck },
] as const;
type View = typeof NAV[number]["id"];

function Login({ onDone }: { onDone: () => void }) {
  const [pw, setPw] = useState(""); const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr("");
    const r = await fetch("/api/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: pw }) });
    setBusy(false); if (r.ok) onDone(); else setErr((await r.json().catch(() => ({}))).error ?? "Login failed");
  };
  return (
    <div className="grid min-h-screen place-items-center bg-gradient-to-br from-slate-950 via-slate-900 to-sky-950 p-4">
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-900/80 p-8 shadow-2xl backdrop-blur">
        <div className="mb-6 flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-sky-500 to-indigo-600 text-white"><Lock size={18} /></div><div><h1 className="font-semibold text-white">Presales Command Center</h1><p className="text-xs text-slate-400">Paytm Pi · restricted</p></div></div>
        <input type="password" autoFocus value={pw} onChange={e => setPw(e.target.value)} placeholder="Password" className="h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-white outline-none focus:ring-2 focus:ring-sky-500/50" />
        {err && <p className="mt-2 text-sm text-rose-400">{err}</p>}
        <button disabled={busy || !pw} className="mt-4 h-11 w-full rounded-lg bg-sky-500 font-medium text-white transition hover:bg-sky-400 disabled:opacity-50">{busy ? "Checking…" : "Enter dashboard"}</button>
      </form>
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState<{ required: boolean; authed: boolean } | null>(null);
  const [data, setData] = useState<Dataset | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [view, setView] = useState<View>(() => (NAV.find(n => "#" + n.id === location.hash)?.id ?? "overview"));
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"));

  useEffect(() => { document.documentElement.classList.toggle("dark", dark); localStorage.theme = dark ? "dark" : "light"; }, [dark]);
  useEffect(() => { location.hash = view; }, [view]);
  useEffect(() => { fetch("/api/session").then(r => r.json()).then(setSession).catch(() => setSession({ required: false, authed: true })); }, []);
  const load = useCallback(async (refresh = false) => {
    setLoading(true); setErr("");
    try { const r = await fetch(`/api/data${refresh ? "?refresh=1" : ""}`); if (r.status === 401) { setSession({ required: true, authed: false }); return; } setData(await r.json()); }
    catch (e) { setErr((e as Error).message); } finally { setLoading(false); }
  }, []);
  useEffect(() => { if (session?.authed) { load(); const t = setInterval(() => load(), 5 * 60e3); return () => clearInterval(t); } }, [session?.authed, load]);

  const f = useMemo(() => data ? applyFilters(data, filters) : { deals: [], demos: [], meetings: [] }, [data, filters]);
  if (!session) return null;
  if (!session.authed) return <Login onDone={() => setSession({ required: true, authed: true })} />;

  const set = (k: keyof Filters, v: string) => setFilters(s => ({ ...s, [k]: v }));
  const active = (Object.keys(filters) as (keyof Filters)[]).filter(k => filters[k] !== defaultFilters[k]);
  const dl = demoDelivery(f.demos);
  const held = f.meetings.filter(m => m.date && m.date <= today() && /^done/i.test(m.status)).length;
  const withNotes = f.meetings.filter(m => /notes found/i.test(m.status)).length;
  const effort = f.deals.reduce((s, d) => s + (d.effortHrs ?? 0), 0);
  const puruPaid = f.deals.filter(isPuruPaid).length; const paidAll = f.deals.filter(d => /^paid$/i.test(d.pocType)).length;

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-slate-200 bg-white/70 p-4 backdrop-blur dark:border-slate-800 dark:bg-slate-950/70 md:flex">
        <div className="mb-8 flex items-center gap-2.5 px-2"><div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-sky-500 to-indigo-600 text-white"><Target size={18} /></div><div><div className="text-sm font-semibold leading-tight">Presales HQ</div><div className="text-[11px] muted">Paytm Pi · Puru Chauhan</div></div></div>
        <nav className="space-y-1">{NAV.map(n => <button key={n.id} onClick={() => setView(n.id)} className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${view === n.id ? "bg-sky-500/10 font-medium text-sky-600 dark:text-sky-400" : "muted hover:bg-slate-100 dark:hover:bg-slate-900"}`}><n.icon size={16} />{n.label}</button>)}</nav>
        <div className="mt-auto space-y-2 text-[11px] muted">
          <div className="flex items-center gap-1.5"><Database size={12} />{data?.source === "google-sheets" ? "Live · Google Sheets" : data?.source === "snapshot" ? "Local snapshot" : "No data"}</div>
          {data && <div>Synced {new Date(data.fetchedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })} IST</div>}
          {session.required && <button onClick={async () => { await fetch("/api/logout", { method: "POST" }); setSession({ required: true, authed: false }); }} className="flex items-center gap-1.5 hover:text-rose-500"><LogOut size={12} />Sign out</button>}
        </div>
      </aside>

      <main className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-slate-50/80 px-4 py-3 backdrop-blur dark:border-slate-800 dark:bg-slate-950/80 md:px-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><h1 className="text-lg font-semibold">{NAV.find(n => n.id === view)?.label}</h1><p className="text-xs muted">Presales Command Center · {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p></div>
            <div className="flex items-center gap-2">
              <select className="select md:hidden" value={view} onChange={e => setView(e.target.value as View)}>{NAV.map(n => <option key={n.id} value={n.id}>{n.label}</option>)}</select>
              <button onClick={() => load(true)} className="select flex items-center gap-1.5" title="Refresh from source"><RefreshCw size={14} className={loading ? "animate-spin" : ""} />Refresh</button>
              <button onClick={() => setDark(d => !d)} className="select" aria-label="Toggle theme">{dark ? <Sun size={15} /> : <Moon size={15} />}</button>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <select className="select" value={filters.period} onChange={e => set("period", e.target.value)}>
              {[["all", "All time"], ["7d", "Last 7 days"], ["30d", "Last 30 days"], ["90d", "Last 90 days"], ["month", "This month"], ["quarter", "This quarter"]].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <select className="select" value={filters.stage} onChange={e => set("stage", e.target.value)}><option value="">All stages</option>{uniq(data?.deals.map(d => d.stage) ?? []).sort(stageSort).map(s => <option key={s}>{s}</option>)}</select>
            <select className="select" value={filters.rep} onChange={e => set("rep", e.target.value)}><option value="">All sales reps</option>{uniq(data?.deals.map(d => d.rep) ?? []).map(s => <option key={s}>{s}</option>)}</select>
            <select className="select" value={filters.demoStatus} onChange={e => set("demoStatus", e.target.value)}><option value="">All demo statuses</option>{uniq(data?.demos.map(d => d.status) ?? []).map(s => <option key={s}>{s}</option>)}</select>
            <select className="select" value={filters.demoType} onChange={e => set("demoType", e.target.value)}><option value="">All demo types</option>{uniq(data?.demos.map(d => d.type) ?? []).map(s => <option key={s}>{s}</option>)}</select>
            <input className="select w-48" placeholder="Global search…" value={filters.q} onChange={e => set("q", e.target.value)} />
            {active.length > 0 && <button onClick={() => setFilters(defaultFilters)} className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm text-rose-500 hover:bg-rose-500/10"><X size={14} />Clear ({active.length})</button>}
          </div>
        </header>

        <div className="space-y-6 p-4 md:p-8">
          {err && <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-500">{err}</div>}
          {data?.error && <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-600 dark:text-amber-400">{data.error}</div>}
          {!data ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="card h-28 animate-pulse" />)}</div> : <>
            {view === "overview" && <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Kpi label="Active deals" value={f.deals.length} hint={`${f.deals.filter(d => d.health === "Active").length} active · ${f.deals.filter(d => /cold/i.test(d.health)).length} cold`} icon={<Briefcase size={16} />} />
              <Kpi label="Demo delivery rate" value={`${dl.rate}%`} hint={`${dl.delivered} delivered · ${dl.dropped} dropped · ${f.demos.length} total`} icon={<MonitorPlay size={16} />} accent="from-violet-500 to-fuchsia-500" />
              <Kpi label="Meetings held" value={held} hint={`${withNotes} with Gemini notes · ${held ? Math.round((withNotes / held) * 100) : 0}%`} icon={<Users size={16} />} accent="from-emerald-500 to-teal-500" />
              <Kpi label="Puru-owned paid POCs" value={puruPaid} hint={`of ${paidAll} paid POCs · ${effort}h presales effort`} icon={<Timer size={16} />} accent="from-amber-500 to-orange-500" />
            </div>}
            {view === "overview" && <Overview f={f} data={data} pick={(k, v) => set(k, v)} />}
            {view === "health" && <Health deals={f.deals} />}
            {view === "actions" && <Actions data={data} deals={f.deals} />}
            {view === "deals" && <Deals deals={f.deals} />}
            {view === "demos" && <Demos demos={f.demos} />}
            {view === "meetings" && <Meetings meetings={f.meetings} data={data} />}
            {view === "quality" && <Quality deals={f.deals} demos={f.demos} />}
          </>}
        </div>
      </main>
    </div>
  );
}
