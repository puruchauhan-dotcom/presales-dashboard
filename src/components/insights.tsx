import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CalendarClock, ListTodo } from "lucide-react";
import { verticalGroup } from "../../shared/model";
import { Badge, Card, Empty, Kpi } from "./ui";
import { Donut, HBar } from "./charts";
import { countBy, daysSince, fmtDate, today, type Dataset, type Deal, type Demo } from "../lib";

export const HEALTH_COLORS: Record<string, string> = { Active: "#10b981", Cooling: "#f59e0b", Cold: "#ef4444", Closed: "#64748b", Unknown: "#94a3b8" };
export { healthTone } from "./health-tone";
import { healthTone } from "./health-tone";
import { useDrill } from "./drill";
const tip = { contentStyle: { background: "#0f172a", border: "1px solid #334155", borderRadius: 10, color: "#e2e8f0", fontSize: 12 }, itemStyle: { color: "#e2e8f0" } };

export const isPuruPaid = (d: Deal) => /puru chauhan/i.test(d.pocOwners) && /^paid$/i.test(d.pocType);
export function demoDelivery(demos: Demo[]) {
  const delivered = demos.filter(d => /deliver/i.test(d.status)).length, dropped = demos.filter(d => /drop/i.test(d.status)).length;
  return { delivered, dropped, rate: delivered + dropped ? Math.round((delivered / (delivered + dropped)) * 100) : 0 };
}

/* -------- POC health, outcomes, blockers, verticals -------- */
export function Health({ deals }: { deals: Deal[] }) {
  const order = ["Active", "Cooling", "Cold", "Closed", "Unknown"];
  const health = order.map(h => ({ name: h, value: deals.filter(d => (d.health || "Unknown") === h).length })).filter(x => x.value);
  const cold = deals.filter(d => /cold|cooling/i.test(d.health)).sort((a, b) => (b.daysSinceTouch ?? 0) - (a.daysSinceTouch ?? 0));
  const paid = deals.filter(d => /^paid$/i.test(d.pocType)), free = deals.filter(d => /^free$/i.test(d.pocType));
  const conv = paid.length + free.length ? Math.round((paid.length / (paid.length + free.length)) * 100) : 0;
  const outcomes = countBy(deals, d => d.outcome || "Open");
  const closed = deals.filter(d => !/^open$/i.test(d.outcome));
  const themes = countBy(deals.filter(d => d.blockerTheme), d => d.blockerTheme);
  const verticals = countBy(deals, d => verticalGroup(d.vertical));
  const { drill, openDeal } = useDrill();
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {order.slice(0, 4).map(h => <Kpi key={h} label={h} value={deals.filter(d => d.health === h).length} hint={{ Active: "touched ≤10 days", Cooling: "11–20 days", Cold: ">20 days", Closed: "won / lost / dropped" }[h]} icon={<span className="h-2.5 w-2.5 rounded-full bg-white" />} accent={{ Active: "from-emerald-500 to-emerald-600", Cooling: "from-amber-400 to-amber-500", Cold: "from-rose-500 to-rose-600", Closed: "from-slate-400 to-slate-500" }[h]} />)}
        <Kpi label="Paid POC conversion" value={`${conv}%`} hint={`${paid.length} paid vs ${free.length} free POCs`} icon={<span className="text-xs font-bold">₹</span>} accent="from-sky-500 to-indigo-500" />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Account health" subtitle="Based on days since last client touch · click a bar">
          <div className="flex flex-wrap items-center justify-center gap-4">
            <div style={{ width: "100%", height: 200 }}><ResponsiveContainer><BarChart data={health} onClick={(st: { activeLabel?: string | number }) => st?.activeLabel != null && drill("health", String(st.activeLabel))} style={{ cursor: "pointer" }}><CartesianGrid vertical={false} stroke="#64748b22" /><XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} /><YAxis allowDecimals={false} stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} width={24} /><Tooltip {...tip} cursor={{ fill: "#0ea5e922" }} />
              <Bar dataKey="value" name="Accounts" radius={[6, 6, 0, 0]} className="cursor-pointer" activeBar={{ fillOpacity: 0.75, stroke: "#e2e8f0", strokeWidth: 1 }}>{health.map(h => <Cell key={h.name} fill={HEALTH_COLORS[h.name]} />)}</Bar></BarChart></ResponsiveContainer></div>
          </div>
        </Card>
        <Card title="Cold & cooling accounts" subtitle={`${cold.length} accounts need a touch`} className="lg:col-span-2">
          <div className="max-h-[300px] overflow-y-auto"><table className="w-full text-sm"><thead className="text-xs uppercase muted"><tr><th className="py-1 text-left">Account</th><th className="text-left">Health</th><th className="text-right">Days</th><th className="pl-3 text-left">Last touch</th><th className="pl-3 text-left">Owner</th></tr></thead>
            <tbody>{cold.map(d => <tr key={d.id} onClick={() => openDeal(d)} className="cursor-pointer hover:bg-sky-500/5 border-t border-slate-100 dark:border-slate-800"><td className="py-1.5"><div className="font-medium">{d.account}</div><div className="text-[11px] muted">{d.stage}</div></td><td><span className={`chip ${healthTone(d.health)}`}>{d.health}</span></td>
              <td className="text-right font-semibold tabular-nums">{d.daysSinceTouch ?? "—"}</td><td className="pl-3 text-xs muted">{fmtDate(d.lastTouch)}{d.lastTouchVia && ` · ${d.lastTouchVia}`}</td><td className="pl-3 text-xs">{d.nextActionOwner || d.rep || "—"}</td></tr>)}</tbody></table>{!cold.length && <Empty text="No cold or cooling accounts." />}</div>
        </Card>
        <Card title="Paid vs free POCs" subtitle={`Conversion = paid ÷ (paid + free) = ${conv}%`}>
          <Donut height={170} data={[{ name: "Paid", value: paid.length }, { name: "Free", value: free.length }, { name: "No POC", value: deals.length - paid.length - free.length }].filter(x => x.value)} onPick={v => drill("pocType", v)} />
          <div className="mt-3 text-xs muted">Paid POCs with Puru Chauhan as owner: <b className="text-sky-500">{deals.filter(isPuruPaid).length}</b></div>
        </Card>
        <Card title="Win / loss outcomes" subtitle={`${closed.length} closed · ${deals.length - closed.length} open`}>
          <Donut height={150} data={outcomes} onPick={v => drill("outcome", v)} />
          <ul className="mt-3 space-y-2 text-xs">{closed.map(d => <li key={d.id} className="rounded-lg bg-slate-50 p-2 dark:bg-slate-800/60"><div className="flex justify-between"><b>{d.account}</b><Badge>{d.outcome}</Badge></div><div className="mt-0.5 muted">{d.outcomeReason || "No reason recorded"}</div></li>)}</ul>
        </Card>
        <Card title="Blocker themes" subtitle="Deals per product gap / blocker · click a bar"><HBar data={themes} height={Math.max(200, themes.length * 28)} color="#f59e0b" onPick={v => drill("blockerTheme", v)} /></Card>
        <Card title="Vertical mix" subtitle="Similar verticals grouped · click a bar to see the accounts" className="lg:col-span-3"><HBar data={verticals} height={Math.max(200, verticals.length * 28)} color="#8b5cf6" onPick={v => drill("vertical", v)} /></Card>
      </div>
    </div>
  );
}

/* -------- This week + next actions -------- */
export function Actions({ data, deals }: { data: Dataset; deals: Deal[] }) {
  const t = today(); const end = new Date(); end.setDate(end.getDate() + 7); const e = end.toISOString().slice(0, 10);
  const week = data.prep.filter(p => p.date && p.date >= t && p.date <= e).sort((a, b) => (a.date! + a.time).localeCompare(b.date! + b.time));
  const due = deals.filter(d => !/^(won|lost|dropped)$/i.test(d.outcome) && (d.nextActionDue || d.nextActionOwner)).sort((a, b) => (a.nextActionDue ?? "9999").localeCompare(b.nextActionDue ?? "9999"));
  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <Card title="This week's meetings" subtitle={`From Prep · ${fmtDate(t)} – ${fmtDate(e)}`} className="lg:col-span-2" right={<CalendarClock size={16} className="muted" />}>
        {week.length ? week.map((p, i) => <div key={i} className="mb-3 rounded-xl border border-slate-200 p-3 dark:border-slate-800"><div className="flex justify-between gap-2"><b>{p.client}</b><span className="text-xs muted whitespace-nowrap">{fmtDate(p.date)} · {p.time}</span></div><div className="text-xs muted">{p.title}</div><p className="mt-2 line-clamp-4 text-xs">{p.brief}</p>{p.link.startsWith("http") && <a href={p.link} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs text-sky-500 hover:underline">Calendar ↗</a>}</div>) : <Empty text="No prep entries this week." />}
      </Card>
      <Card title="Next actions due" subtitle={`${due.filter(d => d.nextActionDue).length} dated · overdue in red`} className="lg:col-span-3" right={<ListTodo size={16} className="muted" />}>
        <div className="max-h-[520px] overflow-y-auto"><table className="w-full text-sm"><thead className="text-xs uppercase muted"><tr><th className="py-1 text-left">Due</th><th className="text-left">Account</th><th className="text-left">Owner</th><th className="text-left">Next step</th></tr></thead>
          <tbody>{due.map(d => { const late = d.nextActionDue && d.nextActionDue < t; const n = daysSince(d.nextActionDue); return (
            <tr key={d.id} className="border-t border-slate-100 align-top dark:border-slate-800"><td className={`whitespace-nowrap py-1.5 pr-2 text-xs ${late ? "font-semibold text-rose-500" : d.nextActionDue === t ? "font-semibold text-amber-500" : "muted"}`}>{d.nextActionDue ? fmtDate(d.nextActionDue) : "No date"}{late && ` (${n}d late)`}</td>
              <td className="pr-2 font-medium">{d.account}</td><td className="pr-2 text-xs">{d.nextActionOwner || "—"}</td><td className="text-xs muted"><span className="line-clamp-2">{d.nextSteps || "—"}</span></td></tr>); })}</tbody></table>{!due.length && <Empty />}</div>
      </Card>
    </div>
  );
}

/* -------- Demo ageing -------- */
export function DemoAgeing({ demos }: { demos: Demo[] }) {
  const pending = demos.filter(d => /pending|progress/i.test(d.status)).map(d => ({ ...d, age: d.daysPending ?? daysSince(d.dateRequested) ?? 0 })).sort((a, b) => b.age - a.age);
  const tone = (n: number) => n > 14 ? "bg-rose-500" : n > 7 ? "bg-amber-500" : "bg-emerald-500";
  const max = Math.max(1, ...pending.map(p => p.age));
  return (
    <Card title="Demo ageing" subtitle={`${pending.length} pending / in progress · amber >7d, red >14d`}>
      <div className="space-y-2">{pending.map((d, i) => <div key={i} className="grid grid-cols-[180px_1fr_60px] items-center gap-3 text-sm"><div className="truncate"><b>{d.client}</b><div className="text-[11px] muted">{d.status} · {d.type}</div></div>
        <div className="h-2.5 rounded-full bg-slate-200 dark:bg-slate-800"><div className={`h-full rounded-full ${tone(d.age)}`} style={{ width: `${(d.age / max) * 100}%` }} /></div><div className={`text-right font-semibold tabular-nums ${d.age > 14 ? "text-rose-500" : d.age > 7 ? "text-amber-500" : ""}`}>{d.age}d</div></div>)}
        {!pending.length && <Empty text="Nothing pending." />}</div>
    </Card>
  );
}
