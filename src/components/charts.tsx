import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useState } from "react";
import { PALETTE } from "../lib";
import { LABEL_TIPS } from "./drill";

/** Y-axis tick that shows a native tooltip for labels with an explanation (e.g. "Vertical not set"). */
function Tick({ x, y, payload, onPick }: { x?: number; y?: number; payload?: { value: string }; onPick?: (n: string) => void }) {
  const v = payload?.value ?? ""; const tip = LABEL_TIPS[v];
  return <g transform={`translate(${x},${y})`} onClick={e => { e.stopPropagation(); onPick?.(v); }} style={{ cursor: onPick ? "pointer" : "default" }}>
    <title>{tip ? `${v}: ${tip}` : onPick ? `Show ${v} accounts` : v}</title>
    <text x={-4} dy={4} textAnchor="end" fontSize={11} fill={tip ? "#f59e0b" : "#64748b"} textDecoration={tip ? "underline dotted" : undefined}>{v.length > 20 ? v.slice(0, 19) + "…" : v}{tip ? " ⓘ" : ""}</text></g>;
}
const tipFmt = (v: number, _n: string, p: { payload?: { name?: string } }) => [v, LABEL_TIPS[p?.payload?.name ?? ""] ? `Count · ${LABEL_TIPS[p.payload!.name!]}` : "Count"];

const tip = { contentStyle: { background: "#0f172a", border: "1px solid #334155", borderRadius: 10, color: "#e2e8f0", fontSize: 12 }, itemStyle: { color: "#e2e8f0" }, labelStyle: { color: "#94a3b8" } };
const axis = { stroke: "#64748b", fontSize: 11, tickLine: false, axisLine: false } as const;

export function Donut({ data, height = 220, onPick }: { data: { name: string; value: number }[]; height?: number; onPick?: (n: string) => void }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const [hover, setHover] = useState<number | null>(null);
  return (
    <div className="flex flex-wrap items-center justify-center gap-4">
      <div className="relative" style={{ width: height, height }}>
        <ResponsiveContainer><PieChart><Pie data={data} dataKey="value" nameKey="name" innerRadius="62%" outerRadius="92%" paddingAngle={2} stroke="none" onClick={(d: { name?: string }) => d?.name && onPick?.(d.name)} onMouseEnter={(_: unknown, i: number) => setHover(i)} onMouseLeave={() => setHover(null)} className={onPick ? "cursor-pointer" : ""} style={onPick ? { cursor: "pointer" } : undefined}>
          {data.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} opacity={onPick && hover != null && hover !== i ? 0.45 : 1} />)}</Pie><Tooltip {...tip} /></PieChart></ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center"><div><div className="text-2xl font-semibold">{total}</div><div className="text-[11px] muted">total</div></div></div>
      </div>
      <ul className="min-w-[170px] flex-1 space-y-1.5 text-xs">
        {data.map((d, i) => <li key={d.name} onClick={() => onPick?.(d.name)} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} title={LABEL_TIPS[d.name] ?? (onPick ? `Show ${d.name} accounts` : undefined)} className={`flex items-center justify-between gap-2 rounded px-1 ${onPick ? "cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800" : ""}`}>
          <span className="flex min-w-0 items-center gap-2 truncate"><span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: PALETTE[i % PALETTE.length] }} />{d.name}</span>
          <span className="tabular-nums muted">{d.value} · {total ? Math.round((d.value / total) * 100) : 0}%</span></li>)}
      </ul>
    </div>
  );
}
export function HBar({ data, height = 260, color = "#0ea5e9", onPick }: { data: { name: string; value: number }[]; height?: number; color?: string; onPick?: (n: string) => void }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16 }} onClick={(st: { activeLabel?: string | number }) => st?.activeLabel != null && onPick?.(String(st.activeLabel))} style={onPick ? { cursor: "pointer" } : undefined}>
        <CartesianGrid horizontal={false} stroke="#64748b22" /><XAxis type="number" allowDecimals={false} {...axis} />
        <YAxis type="category" dataKey="name" width={130} {...axis} interval={0} tick={<Tick onPick={onPick} />} /><Tooltip {...tip} cursor={{ fill: onPick ? "#0ea5e922" : "#64748b18" }} formatter={tipFmt as never} />
        <Bar dataKey="value" name="Count" fill={color} radius={[0, 6, 6, 0]} className={onPick ? "cursor-pointer" : ""} style={onPick ? { cursor: "pointer" } : undefined} activeBar={onPick ? { fill: color, fillOpacity: 0.75, stroke: "#e2e8f0", strokeWidth: 1 } : undefined} />
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
