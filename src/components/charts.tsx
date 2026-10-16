import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PALETTE } from "../lib";

const tip = { contentStyle: { background: "#0f172a", border: "1px solid #334155", borderRadius: 10, color: "#e2e8f0", fontSize: 12 }, itemStyle: { color: "#e2e8f0" }, labelStyle: { color: "#94a3b8" } };
const axis = { stroke: "#64748b", fontSize: 11, tickLine: false, axisLine: false } as const;

export function Donut({ data, height = 220, onPick }: { data: { name: string; value: number }[]; height?: number; onPick?: (n: string) => void }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <div className="flex flex-wrap items-center justify-center gap-4">
      <div className="relative" style={{ width: height, height }}>
        <ResponsiveContainer><PieChart><Pie data={data} dataKey="value" nameKey="name" innerRadius="62%" outerRadius="92%" paddingAngle={2} stroke="none" onClick={(d: { name?: string }) => d?.name && onPick?.(d.name)} className={onPick ? "cursor-pointer" : ""}>
          {data.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}</Pie><Tooltip {...tip} /></PieChart></ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center"><div><div className="text-2xl font-semibold">{total}</div><div className="text-[11px] muted">total</div></div></div>
      </div>
      <ul className="min-w-[170px] flex-1 space-y-1.5 text-xs">
        {data.map((d, i) => <li key={d.name} onClick={() => onPick?.(d.name)} className={`flex items-center justify-between gap-2 rounded px-1 ${onPick ? "cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800" : ""}`}>
          <span className="flex min-w-0 items-center gap-2 truncate"><span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: PALETTE[i % PALETTE.length] }} />{d.name}</span>
          <span className="tabular-nums muted">{d.value} · {total ? Math.round((d.value / total) * 100) : 0}%</span></li>)}
      </ul>
    </div>
  );
}
export function HBar({ data, height = 260, color = "#0ea5e9", onPick }: { data: { name: string; value: number }[]; height?: number; color?: string; onPick?: (n: string) => void }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16 }}>
        <CartesianGrid horizontal={false} stroke="#64748b22" /><XAxis type="number" allowDecimals={false} {...axis} />
        <YAxis type="category" dataKey="name" width={120} {...axis} /><Tooltip {...tip} cursor={{ fill: "#64748b18" }} />
        <Bar dataKey="value" name="Count" fill={color} radius={[0, 6, 6, 0]} onClick={(d: { name?: string }) => d?.name && onPick?.(d.name)} className={onPick ? "cursor-pointer" : ""} />
      </BarChart>
    </ResponsiveContainer>
  );
}
export function Trend({ data, height = 280 }: { data: { label: string; deals: number; demos: number; meetings: number }[]; height?: number }) {
  const series = [["meetings", "Meetings", "#10b981"], ["deals", "Deals assigned", "#0ea5e9"], ["demos", "Demos requested", "#8b5cf6"]] as const;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ left: -16, right: 8 }}>
        <defs>{series.map(([k, , c]) => <linearGradient key={k} id={`g-${k}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={c} stopOpacity={0.35} /><stop offset="100%" stopColor={c} stopOpacity={0} /></linearGradient>)}</defs>
        <CartesianGrid vertical={false} stroke="#64748b22" /><XAxis dataKey="label" {...axis} /><YAxis allowDecimals={false} {...axis} /><Tooltip {...tip} /><Legend wrapperStyle={{ fontSize: 12 }} />
        {series.map(([k, n, c]) => <Area key={k} type="monotone" dataKey={k} name={n} stroke={c} strokeWidth={2} fill={`url(#g-${k})`} />)}
      </AreaChart>
    </ResponsiveContainer>
  );
}
