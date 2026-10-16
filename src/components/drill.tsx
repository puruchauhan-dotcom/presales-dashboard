import { createContext, useContext, type ReactNode } from "react";
import { ArrowRight, Filter, X } from "lucide-react";
import { verticalGroup } from "../../shared/model";
import type { Deal, Demo, Meeting } from "../lib";
import { Badge, Drawer, Empty } from "./ui";
import { healthTone } from "./health-tone";

/** A chart drill-down: which dimension was clicked and which value. */
export type DrillDim = "vertical" | "stage" | "rep" | "health" | "blockerTheme" | "outcome" | "pocType" | "demoStatus" | "demoType" | "requestedBy" | "meetingStatus";
export interface Drill { dim: DrillDim; value: string; label: string }

export const DIM_LABEL: Record<DrillDim, string> = {
  vertical: "Vertical", stage: "Stage", rep: "Sales rep", health: "Health", blockerTheme: "Blocker theme", outcome: "Outcome", pocType: "POC type",
  demoStatus: "Demo status", demoType: "Demo type", requestedBy: "Requested by", meetingStatus: "Meeting status",
};
export const VERTICAL_NOT_SET = "Vertical not set";
export const LABEL_TIPS: Record<string, string> = { [VERTICAL_NOT_SET]: "The Vertical cell is blank in the sheet for these deals" };

const pocBucket = (d: Deal) => /^paid$/i.test(d.pocType) ? "Paid" : /^free$/i.test(d.pocType) ? "Free" : "No POC";
export const dealKey: Partial<Record<DrillDim, (d: Deal) => string>> = {
  vertical: d => verticalGroup(d.vertical), stage: d => d.stage, rep: d => d.rep || "Unassigned", health: d => d.health || "Unknown",
  blockerTheme: d => d.blockerTheme, outcome: d => d.outcome || "Open", pocType: pocBucket,
};
export const demoKey: Partial<Record<DrillDim, (d: Demo) => string>> = { demoStatus: d => d.status, demoType: d => d.type, requestedBy: d => d.requestedBy || "Unknown" };
export const meetingKey: Partial<Record<DrillDim, (m: Meeting) => string>> = { meetingStatus: m => m.status };

export function matchDrill<T extends { deals: Deal[]; demos: Demo[]; meetings: Meeting[] }>(f: T, d: Drill | null): T {
  if (!d) return f;
  const dk = dealKey[d.dim], ek = demoKey[d.dim], mk = meetingKey[d.dim];
  return { ...f, deals: dk ? f.deals.filter(x => dk(x) === d.value) : f.deals, demos: ek ? f.demos.filter(x => ek(x) === d.value) : f.demos, meetings: mk ? f.meetings.filter(x => mk(x) === d.value) : f.meetings };
}
export const isDealDim = (d: DrillDim) => !!dealKey[d];

type Ctx = { drill: (dim: DrillDim, value: string) => void; openDeal: (d: Deal) => void };
export const DrillCtx = createContext<Ctx>({ drill: () => {}, openDeal: () => {} });
export const useDrill = () => useContext(DrillCtx);

/** Chip shown in the header while a drill filter is applied to the Deal pipeline. */
export function DrillChip({ d, onClear }: { d: Drill; onClear: () => void }) {
  return <span className="flex items-center gap-1.5 rounded-lg bg-violet-500/15 px-2 py-1.5 text-sm text-violet-600 dark:text-violet-300"><Filter size={13} />{DIM_LABEL[d.dim]}: <b>{d.label}</b>
    <button onClick={onClear} aria-label="Clear chart filter" title="Clear chart filter" className="rounded p-0.5 hover:bg-violet-500/20"><X size={13} /></button></span>;
}

/** Drawer listing the deals (or demos / meetings) behind a clicked bar or segment. */
export function DrillDrawer({ d, rows, onClose, onPipeline, onOpenDeal, onDemos }: { d: Drill | null; rows: { deals: Deal[]; demos: Demo[]; meetings: Meeting[] }; onClose: () => void; onPipeline: () => void; onOpenDeal: (x: Deal) => void; onDemos: () => void }) {
  const deal = d ? isDealDim(d.dim) : false; const demo = d ? !!demoKey[d.dim] : false;
  const n = !d ? 0 : deal ? rows.deals.length : demo ? rows.demos.length : rows.meetings.length;
  const title = d && <><div className="text-xs muted">{DIM_LABEL[d.dim]}</div><h2 className="text-xl font-semibold" title={LABEL_TIPS[d.label]}>{d.label}</h2>
    {LABEL_TIPS[d.label] && <p className="text-xs text-amber-600 dark:text-amber-400">{LABEL_TIPS[d.label]}</p>}
    <div className="mt-2 flex flex-wrap items-center gap-2"><span className="text-sm muted">{n} {deal ? "deals" : demo ? "demos" : "meetings"}</span>
      {deal && <button onClick={onPipeline} className="flex items-center gap-1 rounded-lg bg-sky-500 px-2.5 py-1 text-xs font-medium text-white hover:bg-sky-400">Open in Deal pipeline<ArrowRight size={12} /></button>}
      {demo && <button onClick={onDemos} className="flex items-center gap-1 rounded-lg bg-sky-500 px-2.5 py-1 text-xs font-medium text-white hover:bg-sky-400">Open in Demo pipeline<ArrowRight size={12} /></button>}</div></>;
  let body: ReactNode = null;
  if (d && deal) body = rows.deals.length ? <table className="w-full text-sm"><thead className="text-xs uppercase muted"><tr><th className="py-1 text-left">Account</th><th className="text-left">Stage</th><th className="text-left">Sales rep</th><th className="text-left">Health</th></tr></thead>
    <tbody>{rows.deals.map(x => <tr key={x.id} onClick={() => onOpenDeal(x)} className="cursor-pointer border-t border-slate-100 align-top hover:bg-sky-500/10 dark:border-slate-800">
      <td className="py-2 pr-2"><div className="font-medium text-sky-600 hover:underline dark:text-sky-400">{x.account}</div><div className="text-[11px] muted">{x.id}</div>{x.notes && <div className="mt-0.5 line-clamp-2 text-xs muted">{x.notes}</div>}</td>
      <td className="pr-2"><Badge>{x.stage}</Badge></td><td className="pr-2 text-xs">{x.rep || <span className="text-amber-500">—</span>}</td><td><span className={`chip ${healthTone(x.health)}`}>{x.health || "Unknown"}</span></td></tr>)}</tbody></table> : <Empty />;
  else if (d && demo) body = rows.demos.length ? <ul className="space-y-2">{rows.demos.map((x, i) => <li key={i} className="rounded-lg border border-slate-200 p-2 text-sm dark:border-slate-800"><div className="flex justify-between gap-2"><b>{x.client}</b><Badge>{x.status}</Badge></div><div className="text-xs muted">{x.type} · {x.requestedBy || "—"}</div>{x.latestUpdate && <div className="mt-1 line-clamp-2 text-xs muted">{x.latestUpdate}</div>}</li>)}</ul> : <Empty />;
  else if (d) body = rows.meetings.length ? <ul className="space-y-2">{rows.meetings.map((x, i) => <li key={i} className="rounded-lg border border-slate-200 p-2 text-sm dark:border-slate-800"><b>{x.title}</b><div className="text-xs muted">{x.date} · {x.time} · {x.client}</div></li>)}</ul> : <Empty />;
  return <Drawer open={!!d} onClose={onClose} title={title}>{body}</Drawer>;
}
