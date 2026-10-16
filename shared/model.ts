// Shared data model + normalisation from raw sheet rows (string[][]).
export type RawTabs = Record<string, string[][]>;

export interface Deal {
  id: string; account: string; opportunity: string; rep: string; lead: string;
  vertical: string; stage: string; value: number | null; dateAssigned: string | null;
  effortHrs: number | null; notes: string; spoc: string; useCase: string; languages: string;
  nextSteps: string; blockers: string; pocOwners: string;
  outcome: string; outcomeReason: string; pocType: string; stageChanged: string | null; lastTouch: string | null;
  lastTouchVia: string; daysSinceTouch: number | null; health: string; nextActionDue: string | null; nextActionOwner: string; blockerTheme: string;
}
export interface Demo {
  client: string; type: string; useCase: string; language: string; requestedBy: string;
  dateRequested: string | null; status: string; owners: string; latestUpdate: string; source: string; deliveredDate: string | null; daysPending: number | null;
}
export interface Meeting {
  date: string | null; time: string; title: string; client: string; type: string; series: string;
  organizer: string; attendees: string; status: string; summary: string; decisions: string; actions: string;
}
export interface Prep { date: string | null; time: string; title: string; client: string; attendees: string; related: string; brief: string; link: string; }
export interface F2F { date: string | null; company: string; title: string; route: string; km: number | null; rate: number | null; amount: number | null; other: number | null; status: string; }

export interface Dataset {
  source: "google-sheets" | "snapshot" | "empty";
  fetchedAt: string; error?: string;
  deals: Deal[]; demos: Demo[]; meetings: Meeting[]; prep: Prep[]; f2f: F2F[];
}

export const TABS = ["Presales Tracker", "Demo Pipeline", "Meetings", "Prep", "F2F Reimbursement"] as const;

const MONTHS: Record<string, number> = { jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12 };
const pad = (n: number) => String(n).padStart(2, "0");

/** Parse mixed date text -> ISO yyyy-mm-dd, or null. Handles "2026-10-16 (Fri)", "16/10/2026", "16 Oct 2026", serials. */
export function parseDate(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s) return null;
  let m = s.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${pad(+m[2])}-${pad(+m[3])}`;
  m = s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})/); // dd/mm/yyyy (India)
  if (m) return `${m[3]}-${pad(+m[2])}-${pad(+m[1])}`;
  m = s.match(/(\d{1,2})\s+([A-Za-z]{3})[a-z]*,?\s+(\d{4})/);
  if (m && MONTHS[m[2].toLowerCase()]) return `${m[3]}-${pad(MONTHS[m[2].toLowerCase()])}-${pad(+m[1])}`;
  if (/^\d{5}$/.test(s)) { const d = new Date(Date.UTC(1899, 11, 30) + +s * 86400000); return d.toISOString().slice(0, 10); }
  return null;
}
const num = (v: unknown): number | null => {
  const s = String(v ?? "").replace(/[₹,\s]/g, "");
  if (!s) return null; const n = Number(s); return Number.isFinite(n) ? n : null;
};
const c = (r: string[], i: number) => (r[i] ?? "").toString().trim();
const headerIndex = (rows: string[][], first: string) => rows.findIndex(r => c(r, 0).toLowerCase() === first.toLowerCase());

/** Locate a header row by required header names; returns row index + column lookup by regex. */
function table(rows: string[][], required: RegExp[]) {
  const h = rows.findIndex(r => required.every(rx => r.some(x => rx.test(String(x ?? "").trim()))));
  const header = h >= 0 ? rows[h].map(x => String(x ?? "").trim()) : [];
  const col = (rx: RegExp) => header.findIndex(x => rx.test(x));
  return { body: h >= 0 ? rows.slice(h + 1) : [], col };
}
const at = (r: string[], i: number) => (i < 0 ? "" : c(r, i));

export function normalise(tabs: RawTabs): Omit<Dataset, "source" | "fetchedAt"> {
  const P = table(tabs["Presales Tracker"] ?? [], [/^deal id$/i, /^account name$/i]);
  const k = {
    id: P.col(/^deal id$/i), account: P.col(/^account name$/i), opp: P.col(/^opportunity/i), rep: P.col(/^sales rep/i), lead: P.col(/presales lead/i),
    vert: P.col(/vertical/i), stage: P.col(/^deal stage/i), value: P.col(/deal value/i), assigned: P.col(/date assigned/i), effort: P.col(/effort/i),
    notes: P.col(/latest status|win\/loss/i), spoc: P.col(/spoc/i), use: P.col(/^use case/i), lang: P.col(/language/i), next: P.col(/^next steps/i),
    blk: P.col(/^blockers/i), poc: P.col(/^poc owners/i), out: P.col(/^outcome$/i), outR: P.col(/^outcome reason/i), pocT: P.col(/^poc type/i),
    stCh: P.col(/stage changed/i), lt: P.col(/^last touch date/i), ltv: P.col(/^last touch via/i), dst: P.col(/days since touch/i), health: P.col(/^health/i),
    nad: P.col(/next action due/i), nao: P.col(/next action owner/i), theme: P.col(/blocker theme/i),
  };
  const deals: Deal[] = P.body.filter(r => at(r, k.id) || at(r, k.account)).map(r => ({
    id: at(r,k.id), account: at(r,k.account), opportunity: at(r,k.opp), rep: at(r,k.rep), lead: at(r,k.lead), vertical: at(r,k.vert),
    stage: at(r,k.stage) || "Unspecified", value: num(at(r,k.value)), dateAssigned: parseDate(at(r,k.assigned)), effortHrs: num(at(r,k.effort)),
    notes: at(r,k.notes), spoc: at(r,k.spoc), useCase: at(r,k.use), languages: at(r,k.lang), nextSteps: at(r,k.next), blockers: at(r,k.blk), pocOwners: at(r,k.poc),
    outcome: at(r,k.out) || "Open", outcomeReason: at(r,k.outR), pocType: at(r,k.pocT) || "None", stageChanged: parseDate(at(r,k.stCh)), lastTouch: parseDate(at(r,k.lt)),
    lastTouchVia: at(r,k.ltv), daysSinceTouch: num(at(r,k.dst)), health: at(r,k.health) || "Unknown", nextActionDue: parseDate(at(r,k.nad)), nextActionOwner: at(r,k.nao), blockerTheme: at(r,k.theme),
  }));
  const D = table(tabs["Demo Pipeline"] ?? [], [/^client$/i, /^demo type$/i]);
  const dk = { client: D.col(/^client$/i), type: D.col(/^demo type/i), use: D.col(/^use case/i), lang: D.col(/^language/i), req: D.col(/^requested by/i), date: D.col(/^date requested/i),
    status: D.col(/^status/i), own: D.col(/owner/i), upd: D.col(/latest update/i), src: D.col(/source/i), del: D.col(/delivered date/i), pend: D.col(/days pending/i) };
  const demos: Demo[] = D.body.filter(r => at(r, dk.client)).map(r => ({
    client: at(r,dk.client), type: at(r,dk.type) || "Unspecified", useCase: at(r,dk.use), language: at(r,dk.lang), requestedBy: at(r,dk.req),
    dateRequested: parseDate(at(r,dk.date)), status: at(r,dk.status) || "Unspecified", owners: at(r,dk.own), latestUpdate: at(r,dk.upd), source: at(r,dk.src),
    deliveredDate: parseDate(at(r,dk.del)), daysPending: num(at(r,dk.pend)),
  }));
  const M = table(tabs["Meetings"] ?? [], [/^date/i, /^meeting title/i]);
  const mk = { d: M.col(/^date/i), t: M.col(/^start time/i), title: M.col(/^meeting title/i), cl: M.col(/^client/i), ty: M.col(/^meeting type/i), se: M.col(/^series/i),
    org: M.col(/^organizer/i), att: M.col(/^attendees/i), st: M.col(/^status/i), sum: M.col(/^summary/i), dec: M.col(/^decisions/i), act: M.col(/^action items/i) };
  const meetings: Meeting[] = M.body.filter(r => at(r, mk.title)).map(r => ({
    date: parseDate(at(r,mk.d)), time: at(r,mk.t), title: at(r,mk.title), client: at(r,mk.cl), type: at(r,mk.ty), series: at(r,mk.se), organizer: at(r,mk.org),
    attendees: at(r,mk.att), status: at(r,mk.st) || "Unspecified", summary: at(r,mk.sum), decisions: at(r,mk.dec), actions: at(r,mk.act),
  }));
  const R = table(tabs["Prep"] ?? [], [/^date/i, /^meeting title/i]);
  const rk = { d: R.col(/^date/i), t: R.col(/^start time/i), title: R.col(/^meeting title/i), cl: R.col(/^client/i), att: R.col(/^attendees/i), rel: R.col(/^related/i), br: R.col(/^prep brief/i), ln: R.col(/event link/i) };
  const prep: Prep[] = R.body.filter(r => at(r, rk.title) && parseDate(at(r, rk.d))).map(r => ({
    date: parseDate(at(r,rk.d)), time: at(r,rk.t), title: at(r,rk.title), client: at(r,rk.cl), attendees: at(r,rk.att), related: at(r,rk.rel), brief: at(r,rk.br), link: at(r,rk.ln),
  }));
  const FF = table(tabs["F2F Reimbursement"] ?? [], [/^date$/i, /^company/i]);
  const fk = { d: FF.col(/^date$/i), co: FF.col(/^company/i), t: FF.col(/calendar title/i), ro: FF.col(/^route/i), km: FF.col(/distance/i), rate: FF.col(/^rate/i), amt: FF.col(/^amount/i), oth: FF.col(/^other/i), st: FF.col(/^status/i) };
  const f2f: F2F[] = FF.body.filter(r => at(r, fk.co)).map(r => ({
    date: parseDate(at(r,fk.d)), company: at(r,fk.co), title: at(r,fk.t), route: at(r,fk.ro), km: num(at(r,fk.km)), rate: num(at(r,fk.rate)), amount: num(at(r,fk.amt)), other: num(at(r,fk.oth)), status: at(r,fk.st),
  }));
  return { deals, demos, meetings, prep, f2f };
}

/** Group fine-grained verticals into broad buckets. */
export function verticalGroup(v: string): string {
  const s = v.toLowerCase();
  if (!s) return "Unspecified";
  if (/financ|fintech|bank|insur|wealth|lend|nbfc/.test(s)) return "BFSI / Fintech";
  if (/retail|e-?commerce|consumer goods|wholesale|fmcg|d2c|jewel/.test(s)) return "Retail & Consumer";
  if (/food|qsr|restaurant|beverage/.test(s)) return "Food & QSR";
  if (/educ|edtech|universit/.test(s)) return "Education";
  if (/travel|mobility|hospitality|hotel|airline|aviation/.test(s)) return "Travel & Hospitality";
  if (/health|pharma|medic/.test(s)) return "Healthcare & Pharma";
  if (/real estate|property|adtech/.test(s)) return "Real Estate";
  if (/media|entertain|ott|consumer apps|devotional|gaming/.test(s)) return "Media & Consumer Apps";
  if (/manufactur|industrial|auto/.test(s)) return "Manufacturing";
  return v.split("/")[0].trim();
}
