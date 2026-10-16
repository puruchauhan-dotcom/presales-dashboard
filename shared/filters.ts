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
const hay = (o: object) => Object.values(o).join(" ").toLowerCase();

export function applyFilters(d: Dataset, f: Filters) {
  const start = periodStart(f.period); const q = f.q.trim().toLowerCase();
  const deals = d.deals.filter(x => inPeriod(x.dateAssigned, start) && (!f.stage || x.stage === f.stage) && (!f.rep || x.rep === f.rep) && (!q || hay(x).includes(q)));
  const demos = d.demos.filter(x => inPeriod(x.dateRequested, start) && (!f.demoStatus || x.status === f.demoStatus) && (!f.demoType || x.type === f.demoType) && (!f.rep || x.requestedBy === f.rep || x.owners.includes(f.rep)) && (!q || hay(x).includes(q)));
  const meetings = d.meetings.filter(x => inPeriod(x.date, start) && (!q || hay(x).includes(q)));
  return { deals, demos, meetings };
}

