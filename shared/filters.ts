import type { Dataset } from "./model.js";
export interface Filters { period: string; stage: string; rep: string; demoStatus: string; demoType: string; q: string; }
export const defaultFilters: Filters = { period: "all", stage: "", rep: "", demoStatus: "", demoType: "", q: "" };

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
const STOP = new Set(["the", "paytm", "pi", "ltd", "limited", "pvt", "private", "india", "international", "company", "co", "group", "technologies", "tech", "software"]);
export const key = (name: string) => (name || "").toLowerCase().replace(/[^a-z0-9+ ]/g, " ").split(/\s+/).filter(w => w && !STOP.has(w))[0]?.replace(/soft$/, "") ?? "";
const matches = (name: string, keys: string[]) => { const k = key(name); return !!k && keys.some(s => k.startsWith(s) || s.startsWith(k)); };
const hay = (o: object) => Object.values(o).join(" ").toLowerCase();

export function applyFilters(d: Dataset, f: Filters) {
  const start = periodStart(f.period); const q = f.q.trim().toLowerCase();
  const deals = d.deals.filter(x => inPeriod(x.dateAssigned, start) && (!f.stage || x.stage === f.stage) && (!f.rep || x.rep === f.rep) && (!q || hay(x).includes(q)));
  // A stage filter also narrows demos and meetings to accounts whose deal is in that stage.
  const stageKeys = f.stage ? d.deals.filter(x => x.stage === f.stage).map(x => key(x.account)).filter(Boolean) : null;
  const inStage = (name: string) => !stageKeys || matches(name, stageKeys);
  const demos = d.demos.filter(x => inPeriod(x.dateRequested, start) && inStage(x.client) && (!f.demoStatus || x.status === f.demoStatus) && (!f.demoType || x.type === f.demoType) && (!f.rep || x.requestedBy === f.rep || x.owners.includes(f.rep)) && (!q || hay(x).includes(q)));
  const meetings = d.meetings.filter(x => inPeriod(x.date, start) && inStage(x.client) && (!q || hay(x).includes(q)));
  return { deals, demos, meetings };
}

