import { useMemo, useState } from "react";
import { AlertTriangle, CalendarDays, ChevronLeft, ChevronRight, Clock, Columns3, List, Search, Users } from "lucide-react";
import { Badge, Card, Drawer, Empty, Field } from "./ui";
import { Donut, HBar, Trend } from "./charts";
import { DemoAgeing, healthTone } from "./insights";
import { useDrill } from "./drill";
import { verticalGroup } from "../../shared/model";
import { countBy, daysSince, fmtDate, stageSort, today, uniq, weekly, type Dataset, type Deal, type Demo, type Meeting } from "../lib";

type F = { deals: Deal[]; demos: Demo[]; meetings: Meeting[] };

/* ---------------- Overview ---------------- */
export function Overview({ f, data }: { f: F; data: Dataset }) {
  const { drill } = useDrill();
  const trend = useMemo(() => weekly(f.deals, f.demos, f.meetings), [f]);
  const upcoming = data.meetings.filter(m => m.date && m.date >= today()).sort((a, b) => (a.date! + a.time).localeCompare(b.date! + b.time)).slice(0, 6);
  const stale = f.deals.filter(d => (daysSince(d.dateAssigned) ?? 0) > 21 && d.stage === "Discovery").length;
  const blocked = f.deals.filter(d => d.blockers).length;
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card title="Weekly activity" subtitle="Last 12 weeks · deals assigned, demos requested, meetings" className="lg:col-span-2"><Trend data={trend} /></Card>
      <Card title="Attention needed" subtitle="Signals from the tracker">
        <ul className="space-y-3 text-sm">
          <li className="flex items-center justify-between"><span className="flex items-center gap-2"><AlertTriangle size={15} className="text-amber-500" />Deals with blockers</span><b className="tabular-nums">{blocked}</b></li>
          <li className="flex items-center justify-between"><span className="flex items-center gap-2"><Clock size={15} className="text-rose-500" />Discovery &gt; 21 days</span><b className="tabular-nums">{stale}</b></li>
          <li className="flex items-center justify-between"><span className="flex items-center gap-2"><Users size={15} className="text-sky-500" />Demos unclear/dropped</span><b className="tabular-nums">{f.demos.filter(d => /unclear|drop/i.test(d.status)).length}</b></li>
        </ul>
        <h4 className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wide muted">Upcoming meetings</h4>
        {upcoming.length ? <ul className="space-y-2">{upcoming.map((m, i) => <li key={i} className="rounded-lg bg-slate-50 p-2 text-xs dark:bg-slate-800/60"><div className="font-medium">{m.client || m.title}</div><div className="muted">{fmtDate(m.date)} · {m.time} IST</div></li>)}</ul> : <p className="text-xs muted">None scheduled in tracker.</p>}
      </Card>
      <Card title="Deals by stage" subtitle="Click to see the accounts"><Donut height={170} data={countBy(f.deals, d => d.stage).sort((a, b) => stageSort(a.name, b.name))} onPick={v => drill("stage", v)} /></Card>
      <Card title="Demo status" subtitle="Click to see the demos"><Donut height={170} data={countBy(f.demos, d => d.status)} onPick={v => drill("demoStatus", v)} /></Card>
      <Card title="Demos by type" subtitle="Click to see the demos"><Donut height={170} data={countBy(f.demos, d => d.type)} onPick={v => drill("demoType", v)} /></Card>
      <Card title="Top sales reps" subtitle="Deals per rep · click to see the accounts" className="lg:col-span-2"><HBar data={countBy(f.deals, d => d.rep || "Unassigned").slice(0, 10)} onPick={v => drill("rep", v)} /></Card>
      <Card title="Verticals" subtitle="Grouped · click to see the accounts"><HBar data={countBy(f.deals, d => verticalGroup(d.vertical)).slice(0, 8)} color="#8b5cf6" onPick={v => drill("vertical", v)} /></Card>
    </div>
  );
}

/* ---------------- Deals ---------------- */
export function Deals({ deals }: { deals: Deal[] }) {
  const [mode, setMode] = useState<"kanban" | "table">("kanban");
  const { openDeal } = useDrill(); const setOpen = (d: Deal | null) => d && openDeal(d);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<{ k: keyof Deal; dir: 1 | -1 }>({ k: "dateAssigned", dir: -1 });
  const rows = useMemo(() => {
    const s = q.toLowerCase();
    return deals.filter(d => !s || Object.values(d).join(" ").toLowerCase().includes(s))
      .sort((a, b) => String(a[sort.k] ?? "").localeCompare(String(b[sort.k] ?? ""), undefined, { numeric: true }) * sort.dir);
  }, [deals, q, sort]);
  const stages = uniq(rows.map(d => d.stage)).sort(stageSort);
  const th = (k: keyof Deal, label: string) => <th onClick={() => setSort(s => ({ k, dir: s.k === k ? (-s.dir as 1 | -1) : 1 }))} className="cursor-pointer select-none whitespace-nowrap px-3 py-2 text-left font-medium hover:text-sky-500">{label}{sort.k === k ? (sort.dir === 1 ? " ▲" : " ▼") : ""}</th>;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]"><Search size={15} className="absolute left-3 top-2.5 muted" /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Search account, SPOC, use case, blockers…" className="select w-full pl-9" /></div>
        <div className="flex rounded-lg border border-slate-200 p-0.5 dark:border-slate-700">
          {(["kanban", "table"] as const).map(m => <button key={m} onClick={() => setMode(m)} className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm ${mode === m ? "bg-sky-500 text-white" : "muted"}`}>{m === "kanban" ? <Columns3 size={14} /> : <List size={14} />}{m === "kanban" ? "Board" : "Table"}</button>)}
        </div>
        <span className="text-sm muted">{rows.length} deals</span>
      </div>
      {mode === "kanban" ? (
        <div className="flex gap-4 overflow-x-auto pb-2">
          {stages.length ? stages.map(st => { const col = rows.filter(d => d.stage === st); return (
            <div key={st} className="w-80 shrink-0 rounded-2xl bg-slate-100/70 p-3 dark:bg-slate-900/40">
              <div className="mb-3 flex items-center justify-between px-1"><h3 className="text-sm font-semibold">{st}</h3><span className="chip bg-slate-500/15">{col.length}</span></div>
              <div className="max-h-[68vh] space-y-2 overflow-y-auto pr-1">{col.map(d => (
                <button key={d.id} onClick={() => setOpen(d)} className="card block w-full p-3 text-left transition hover:-translate-y-0.5 hover:border-sky-500/50 hover:shadow-md">
                  <div className="flex items-center justify-between gap-2"><span className="truncate font-medium">{d.account}</span><span className="text-[10px] muted">{d.id}</span></div>
                  <div className="mt-0.5 line-clamp-2 text-xs muted">{d.opportunity}</div>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
                    <span className="chip bg-indigo-500/15 text-indigo-600 dark:text-indigo-300">{d.rep || "No rep"}</span>
                    <span className={`chip ${healthTone(d.health)}`}>{d.health}{d.daysSinceTouch != null ? ` · ${d.daysSinceTouch}d` : ""}</span>{d.pocType === "Paid" && <span className="chip bg-sky-500/15 text-sky-600 dark:text-sky-400">Paid POC</span>}
                    {d.blockers && <span className="chip bg-amber-500/15 text-amber-600 dark:text-amber-400">blocker</span>}
                  </div>
                </button>))}</div>
            </div>); }) : <Empty />}
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase tracking-wide muted dark:border-slate-800"><tr>{th("id", "ID")}{th("account", "Account")}{th("opportunity", "Opportunity")}{th("rep", "Sales rep")}{th("stage", "Stage")}{th("vertical", "Vertical")}{th("dateAssigned", "Assigned")}{th("effortHrs", "Effort h")}</tr></thead>
            <tbody>{rows.map(d => (
              <tr key={d.id} onClick={() => setOpen(d)} className="cursor-pointer border-b border-slate-100 hover:bg-sky-500/5 dark:border-slate-800/70">
                <td className="whitespace-nowrap px-3 py-2 text-xs muted">{d.id}</td><td className="px-3 py-2 font-medium">{d.account}</td><td className="max-w-xs truncate px-3 py-2">{d.opportunity}</td>
                <td className="px-3 py-2">{d.rep || <span className="text-amber-500">—</span>}</td><td className="px-3 py-2"><Badge>{d.stage}</Badge></td><td className="px-3 py-2 text-xs muted">{d.vertical}</td>
                <td className="whitespace-nowrap px-3 py-2">{fmtDate(d.dateAssigned)}</td><td className="px-3 py-2 tabular-nums">{d.effortHrs ?? "—"}</td>
              </tr>))}</tbody>
          </table>{!rows.length && <Empty />}
        </div>
      )}
    </div>
  );
}

/** Deal detail drawer, shared by the pipeline, chart drill-downs and tables. */
export function DealDrawer({ open, setOpen }: { open: Deal | null; setOpen: (d: Deal | null) => void }) {
  return (
    <Drawer open={!!open} onClose={() => setOpen(null)} title={open && <><div className="text-xs muted">{open.id} · {open.vertical}</div><h2 className="text-xl font-semibold">{open.account}</h2><p className="text-sm muted">{open.opportunity}</p><div className="mt-2 flex gap-2"><Badge>{open.stage}</Badge><Badge tone="bg-indigo-500/15 text-indigo-600 dark:text-indigo-300">{open.rep || "No rep"}</Badge></div></>}>
        {open && <div>
          <div className="grid grid-cols-3 gap-3 pb-2 text-center">
            {[["Assigned", fmtDate(open.dateAssigned)], ["Effort", open.effortHrs != null ? `${open.effortHrs} h` : "—"], ["Age", daysSince(open.dateAssigned) != null ? `${daysSince(open.dateAssigned)} d` : "—"]].map(([k, v]) => <div key={k} className="rounded-xl bg-slate-100 p-2 dark:bg-slate-800"><div className="text-[11px] muted">{k}</div><div className="font-semibold">{v}</div></div>)}
          </div>
          <Field label="Client SPOC" value={open.spoc} /><Field label="Use case" value={open.useCase} /><Field label="Latest status" value={open.notes} /><Field label="Outcome" value={`${open.outcome}${open.outcomeReason ? " — " + open.outcomeReason : ""}`} /><Field label="Health / last touch" value={`${open.health} · ${open.daysSinceTouch ?? "?"} days · ${fmtDate(open.lastTouch)} ${open.lastTouchVia}`} /><Field label="POC type" value={open.pocType} /><Field label="Next action" value={open.nextActionOwner ? `${open.nextActionOwner}${open.nextActionDue ? " · due " + fmtDate(open.nextActionDue) : ""}` : ""} /><Field label="Blocker theme" value={open.blockerTheme} />
          <Field label="Next steps" value={open.nextSteps} /><Field label="Blockers / product gaps" value={open.blockers} /><Field label="POC owners" value={open.pocOwners} />
          <Field label="Language(s)" value={open.languages} /><Field label="Presales lead" value={open.lead} /><Field label="Deal value (INR)" value={open.value?.toLocaleString("en-IN")} />
        </div>}
    </Drawer>
  );
}

/* ---------------- Demos ---------------- */
export function Demos({ demos }: { demos: Demo[] }) {
  const [open, setOpen] = useState<Demo | null>(null);
  const { drill } = useDrill();
  const statuses = uniq(demos.map(d => d.status));
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">{statuses.map(s => <div key={s} onClick={() => drill("demoStatus", s)} title={`Show ${s} demos`} className="card cursor-pointer p-3 transition hover:border-sky-500/50 hover:shadow-md"><Badge>{s}</Badge><div className="mt-2 text-2xl font-semibold">{demos.filter(d => d.status === s).length}</div></div>)}</div>
      <DemoAgeing demos={demos} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Demo type mix" subtitle="Click to see the demos"><Donut data={countBy(demos, d => d.type)} onPick={v => drill("demoType", v)} /></Card>
        <Card title="Requested by" subtitle="Click to see the demos"><HBar data={countBy(demos, d => d.requestedBy || "Unknown").slice(0, 8)} color="#10b981" height={220} onPick={v => drill("requestedBy", v)} /></Card>
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm"><thead className="border-b border-slate-200 text-xs uppercase tracking-wide muted dark:border-slate-800"><tr>{["Client", "Type", "Use case", "Requested by", "Requested", "Status", "Latest update"].map(h => <th key={h} className="px-3 py-2 text-left font-medium">{h}</th>)}</tr></thead>
          <tbody>{[...demos].sort((a, b) => (b.dateRequested ?? "").localeCompare(a.dateRequested ?? "")).map((d, i) => (
            <tr key={i} onClick={() => setOpen(d)} className="cursor-pointer border-b border-slate-100 hover:bg-sky-500/5 dark:border-slate-800/70">
              <td className="px-3 py-2 font-medium">{d.client}</td><td className="px-3 py-2"><Badge tone="bg-violet-500/15 text-violet-600 dark:text-violet-300">{d.type}</Badge></td>
              <td className="max-w-xs truncate px-3 py-2">{d.useCase}</td><td className="px-3 py-2">{d.requestedBy}</td><td className="whitespace-nowrap px-3 py-2">{fmtDate(d.dateRequested)}</td>
              <td className="px-3 py-2"><Badge>{d.status}</Badge></td><td className="max-w-sm truncate px-3 py-2 text-xs muted">{d.latestUpdate}</td></tr>))}</tbody></table>
        {!demos.length && <Empty />}
      </div>
      <Drawer open={!!open} onClose={() => setOpen(null)} title={open && <><h2 className="text-xl font-semibold">{open.client}</h2><div className="mt-2 flex gap-2"><Badge>{open.status}</Badge><Badge tone="bg-violet-500/15 text-violet-600 dark:text-violet-300">{open.type}</Badge></div></>}>
        {open && <div><Field label="Use case" value={open.useCase} /><Field label="Language" value={open.language} /><Field label="Requested by" value={open.requestedBy} /><Field label="Date requested" value={fmtDate(open.dateRequested)} /><Field label="Paytm owner(s)" value={open.owners} /><Field label="Latest update" value={open.latestUpdate} />
          {open.source.startsWith("http") && <a href={open.source} target="_blank" rel="noreferrer" className="mt-4 inline-block text-sm text-sky-500 hover:underline">Open source thread ↗</a>}</div>}
      </Drawer>
    </div>
  );
}

/* ---------------- Meetings ---------------- */
export function Meetings({ meetings, data }: { meetings: Meeting[]; data: Dataset }) {
  const [month, setMonth] = useState(() => today().slice(0, 7));
  const [open, setOpen] = useState<Meeting | null>(null);
  const { drill } = useDrill();
  const byDate = useMemo(() => { const m = new Map<string, Meeting[]>(); meetings.forEach(x => x.date && m.set(x.date, [...(m.get(x.date) ?? []), x])); return m; }, [meetings]);
  const [y, mo] = month.split("-").map(Number);
  const first = new Date(Date.UTC(y, mo - 1, 1)); const lead = (first.getUTCDay() + 6) % 7; const days = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  const shift = (n: number) => { const d = new Date(Date.UTC(y, mo - 1 + n, 1)); setMonth(d.toISOString().slice(0, 7)); };
  const sorted = [...meetings].sort((a, b) => ((b.date ?? "") + b.time).localeCompare((a.date ?? "") + a.time));
  return (
    <div className="grid gap-4 xl:grid-cols-5">
      <div className="space-y-4 xl:col-span-2">
        <Card title={first.toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" })} right={<div className="flex gap-1"><button onClick={() => shift(-1)} className="rounded p-1 hover:bg-slate-100 dark:hover:bg-slate-800"><ChevronLeft size={16} /></button><button onClick={() => shift(1)} className="rounded p-1 hover:bg-slate-100 dark:hover:bg-slate-800"><ChevronRight size={16} /></button></div>}>
          <div className="grid grid-cols-7 gap-1 text-center text-[11px] muted">{["M", "T", "W", "T", "F", "S", "S"].map((d, i) => <div key={i}>{d}</div>)}</div>
          <div className="mt-1 grid grid-cols-7 gap-1">
            {Array.from({ length: lead }).map((_, i) => <div key={"x" + i} />)}
            {Array.from({ length: days }).map((_, i) => { const iso = `${month}-${String(i + 1).padStart(2, "0")}`; const n = byDate.get(iso)?.length ?? 0; return (
              <div key={iso} title={`${n} meetings`} className={`aspect-square rounded-lg p-1 text-left text-xs ${iso === today() ? "ring-2 ring-sky-500" : ""} ${n ? (n > 2 ? "bg-emerald-500 text-white" : n > 1 ? "bg-emerald-500/60 text-white" : "bg-emerald-500/25") : "bg-slate-100 dark:bg-slate-800/50"}`}>
                <div>{i + 1}</div>{n > 0 && <div className="text-[10px] font-semibold">{n}</div>}</div>); })}
          </div>
        </Card>
        <Card title="Meeting status" subtitle="Click to see the meetings"><Donut data={countBy(meetings, m => m.status)} height={180} onPick={v => drill("meetingStatus", v)} /></Card>
        <Card title="Prep briefs" subtitle="Upcoming client meetings">{data.prep.length ? data.prep.map((p, i) => <div key={i} className="mb-3 rounded-lg bg-slate-50 p-3 text-xs dark:bg-slate-800/60"><div className="font-medium text-sm">{p.client} <span className="muted font-normal">· {fmtDate(p.date)} {p.time}</span></div><p className="mt-1 line-clamp-3 muted">{p.brief}</p></div>) : <Empty text="No prep briefs." />}</Card>
        <Card title="F2F reimbursement">{data.f2f.map((r, i) => <div key={i} className="flex items-center justify-between border-b border-slate-100 py-2 text-xs dark:border-slate-800"><div><div className="font-medium">{r.company}</div><div className="muted">{fmtDate(r.date)} · {r.km ?? "?"} km @ ₹{r.rate ?? "?"}</div></div><Badge>{r.status || "—"}</Badge></div>)}</Card>
      </div>
      <Card title="Timeline" subtitle={`${meetings.length} meetings`} className="xl:col-span-3">
        <ol className="relative max-h-[120vh] overflow-y-auto border-l border-slate-200 pl-5 dark:border-slate-800">
          {sorted.map((m, i) => (
            <li key={i} className="mb-4 cursor-pointer" onClick={() => setOpen(m)}>
              <span className={`absolute -left-[5px] mt-1.5 h-2.5 w-2.5 rounded-full ${m.date && m.date >= today() ? "bg-sky-500" : "bg-emerald-500"}`} />
              <div className="flex flex-wrap items-center gap-2 text-xs muted"><CalendarDays size={12} />{fmtDate(m.date)} · {m.time} <Badge>{m.status}</Badge></div>
              <div className="mt-0.5 font-medium hover:text-sky-500">{m.title}</div>
              {m.summary && <p className="mt-0.5 line-clamp-2 text-xs muted">{m.summary}</p>}
            </li>))}
          {!sorted.length && <Empty />}
        </ol>
      </Card>
      <Drawer open={!!open} onClose={() => setOpen(null)} title={open && <><div className="text-xs muted">{fmtDate(open.date)} · {open.time} IST</div><h2 className="text-lg font-semibold">{open.title}</h2><div className="mt-2"><Badge>{open.status}</Badge></div></>}>
        {open && <div><Field label="Client" value={open.client} /><Field label="Organizer" value={open.organizer} /><Field label="Attendees" value={open.attendees} /><Field label="Summary" value={open.summary} /><Field label="Decisions" value={open.decisions} /><Field label="Action items" value={open.actions} /></div>}
      </Drawer>
    </div>
  );
}

/* ---------------- Data quality ---------------- */
export function Quality({ deals, demos }: { deals: Deal[]; demos: Demo[] }) {
  const checks: { label: string; field: keyof Deal }[] = [
    { label: "Sales rep", field: "rep" }, { label: "Date assigned", field: "dateAssigned" }, { label: "Effort hrs", field: "effortHrs" }, { label: "Client SPOC", field: "spoc" },
    { label: "Use case", field: "useCase" }, { label: "Next steps", field: "nextSteps" }, { label: "POC owners", field: "pocOwners" }, { label: "Language(s)", field: "languages" }, { label: "Deal value", field: "value" },
  ];
  const missing = (d: Deal, k: keyof Deal) => d[k] == null || d[k] === "";
  const stats = checks.map(c => ({ ...c, n: deals.filter(d => missing(d, c.field)).length }));
  const score = deals.length ? Math.round((1 - stats.reduce((s, x) => s + x.n, 0) / (deals.length * checks.length)) * 100) : 100;
  const worst = deals.map(d => ({ d, gaps: checks.filter(c => missing(d, c.field)).map(c => c.label) })).filter(x => x.gaps.length).sort((a, b) => b.gaps.length - a.gaps.length);
  const reps = uniq(deals.map(d => d.rep)); const dupes: string[] = [];
  reps.forEach((a, i) => reps.slice(i + 1).forEach(b => { const fa = a.split(" ")[0].toLowerCase(), fb = b.split(" ")[0].toLowerCase(); if (fa.length > 3 && (fa.startsWith(fb.slice(0, 4)) || fb.startsWith(fa.slice(0, 4)))) dupes.push(`${a} ↔ ${b}`); }));
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card title="Completeness score" subtitle="Across 9 key deal fields">
        <div className="flex items-end gap-2"><span className={`text-5xl font-semibold ${score > 80 ? "text-emerald-500" : score > 60 ? "text-amber-500" : "text-rose-500"}`}>{score}%</span><span className="mb-2 text-sm muted">{deals.length} deals</span></div>
        <div className="mt-4 space-y-2.5">{stats.map(s => { const pct = deals.length ? Math.round(((deals.length - s.n) / deals.length) * 100) : 100; return (
          <div key={s.label}><div className="flex justify-between text-xs"><span>{s.label}</span><span className="muted">{s.n ? `${s.n} missing` : "complete"}</span></div>
            <div className="mt-1 h-1.5 rounded-full bg-slate-200 dark:bg-slate-800"><div className={`h-full rounded-full ${pct > 80 ? "bg-emerald-500" : pct > 40 ? "bg-amber-500" : "bg-rose-500"}`} style={{ width: `${pct}%` }} /></div></div>); })}</div>
      </Card>
      <Card title="Deals with gaps" subtitle="Most incomplete first" className="lg:col-span-2">
        <div className="max-h-[520px] overflow-y-auto"><table className="w-full text-sm"><tbody>{worst.map(({ d, gaps }) => (
          <tr key={d.id} className="border-b border-slate-100 dark:border-slate-800/70"><td className="py-2 pr-3"><div className="font-medium">{d.account}</div><div className="text-xs muted">{d.id} · {d.rep || "no rep"}</div></td>
            <td className="py-2"><div className="flex flex-wrap gap-1">{gaps.map(g => <span key={g} className="chip bg-amber-500/15 text-amber-600 dark:text-amber-400">{g}</span>)}</div></td></tr>))}</tbody></table></div>
      </Card>
      <Card title="Possible duplicate reps">{dupes.length ? dupes.map(x => <div key={x} className="py-1 text-sm">{x}</div>) : <p className="text-sm muted">None detected.</p>}</Card>
      <Card title="Demo pipeline gaps" className="lg:col-span-2"><ul className="space-y-1 text-sm">
        <li>Language not stated: <b>{demos.filter(d => !d.language || /not stated/i.test(d.language)).length}</b> of {demos.length}</li>
        <li>Missing request date: <b>{demos.filter(d => !d.dateRequested).length}</b></li>
        <li>Status unclear: <b>{demos.filter(d => /unclear/i.test(d.status)).length}</b></li></ul></Card>
    </div>
  );
}
