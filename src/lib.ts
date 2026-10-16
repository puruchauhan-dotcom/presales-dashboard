import type { Dataset, Deal, Demo, Meeting } from "../shared/model";
export type { Dataset, Deal, Demo, Meeting };

export interface Filters { period: string; stage: string; rep: string; demoStatus: string; demoType: string; q: string; }
export const defaultFilters: Filters = { period: "all", stage: "", rep: "", demoStatus: "", demoType: "", q: "" };

export const today = () => new Date().toISOString().slice(0, 10);
export function periodStart(p: string): string | null {
  const d = new Date();
  if (p === "7d") d.setDate(d.getDate() - 7);
  else if (p === "30d") d.setDate(d.getDate() - 30);
  else if (p === "90d") d.setDate(d.getDate() - 90);
  else if (p === "month") d.setDate(1);
  else if (p === "quarter") { d.setMonth(Math.floor(d.getMonth() / 3) * 3); d.setDate(1); }
  else return null;
  return d.toISOString().slice(0, 10);
}
const inPeriod = (date: string | null, start: string | null) => !start || (!!date && date >= start);
const hay = (o: object) => Object.values(o).join(" ").toLowerCase();

export function applyFilters(d: Dataset, f: Filters) {
  const start = periodStart(f.period); const q = f.q.trim().toLowerCase();
  const deals = d.deals.filter(x => inPeriod(x.dateAssigned, start) && (!f.stage || x.stage === f.stage) && (!f.rep || x.rep === f.rep) && (!q || hay(x).includes(q)));
  const demos = d.demos.filter(x => inPeriod(x.dateRequested, start) && (!f.demoStatus || x.status === f.demoStatus) && (!f.demoType || x.type === f.demoType) && (!f.rep || x.requestedBy === f.rep || x.owners.includes(f.rep)) && (!q || hay(x).includes(q)));
  const meetings = d.meetings.filter(x => inPeriod(x.date, start) && (!q || hay(x).includes(q)));
  return { deals, demos, meetings };
}

export const uniq = (a: string[]) => [...new Set(a.filter(Boolean))].sort((x, y) => x.localeCompare(y));
export function countBy<T>(a: T[], k: (t: T) => string) {
  const m = new Map<string, number>(); a.forEach(t => m.set(k(t), (m.get(k(t)) ?? 0) + 1));
  return [...m.entries()].map(([name, value]) => ({ name, value })).sort((x, y) => y.value - x.value);
}
export function weekStart(iso: string) { const d = new Date(iso + "T00:00:00Z"); const day = (d.getUTCDay() + 6) % 7; d.setUTCDate(d.getUTCDate() - day); return d.toISOString().slice(0, 10); }
export function weekly(deals: Deal[], demos: Demo[], meetings: Meeting[], weeks = 12) {
  const end = weekStart(today()); const rows: { week: string; label: string; deals: number; demos: number; meetings: number }[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const d = new Date(end + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() - 7 * i); const w = d.toISOString().slice(0, 10);
    rows.push({ week: w, label: d.toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" }), deals: 0, demos: 0, meetings: 0 });
  }
  const idx = new Map(rows.map((r, i) => [r.week, i]));
  const add = (date: string | null, k: "deals" | "demos" | "meetings") => { if (!date) return; const i = idx.get(weekStart(date)); if (i != null) rows[i][k]++; };
  deals.forEach(x => add(x.dateAssigned, "deals")); demos.forEach(x => add(x.dateRequested, "demos")); meetings.forEach(x => add(x.date, "meetings"));
  return rows;
}
export const fmtDate = (iso: string | null) => iso ? new Date(iso + "T00:00:00Z").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "—";
export const daysSince = (iso: string | null) => iso ? Math.floor((Date.now() - new Date(iso + "T00:00:00Z").getTime()) / 864e5) : null;

export const STAGE_ORDER = ["Discovery", "Technical Demo", "POC / Demo", "Proposal", "Negotiation", "Closed Won", "Closed Lost"];
export const stageSort = (a: string, b: string) => { const i = STAGE_ORDER.indexOf(a), j = STAGE_ORDER.indexOf(b); return (i < 0 ? 99 : i) - (j < 0 ? 99 : j) || a.localeCompare(b); };
export const PALETTE = ["#0ea5e9", "#8b5cf6", "#10b981", "#f59e0b", "#ef4444", "#ec4899", "#14b8a6", "#6366f1", "#84cc16", "#f97316"];
export const statusTone = (s: string) => {
  const t = s.toLowerCase();
  if (/deliver|done|won|complete/.test(t)) return "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400";
  if (/progress|pending|poc|demo/.test(t)) return "bg-sky-500/15 text-sky-600 dark:text-sky-400";
  if (/drop|lost|cancel/.test(t)) return "bg-rose-500/15 text-rose-600 dark:text-rose-400";
  if (/unclear|no notes|tbd/.test(t)) return "bg-amber-500/15 text-amber-600 dark:text-amber-400";
  return "bg-slate-500/15 text-slate-600 dark:text-slate-300";
};
