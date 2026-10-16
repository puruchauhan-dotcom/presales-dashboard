import { X } from "lucide-react";
import type { ReactNode } from "react";
import { statusTone } from "../lib";

export function Card({ title, subtitle, right, children, className = "" }: { title?: string; subtitle?: string; right?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`card p-4 ${className}`}>
      {title && <header className="mb-3 flex items-start justify-between gap-2"><div><h3 className="text-sm font-semibold">{title}</h3>{subtitle && <p className="text-xs muted">{subtitle}</p>}</div>{right}</header>}
      {children}
    </section>
  );
}
export function Kpi({ label, value, hint, icon, accent = "from-sky-500 to-indigo-500" }: { label: string; value: ReactNode; hint?: ReactNode; icon: ReactNode; accent?: string }) {
  return (
    <div className="card relative overflow-hidden p-4">
      <div className={`absolute -right-6 -top-6 h-20 w-20 rounded-full bg-gradient-to-br ${accent} opacity-15 blur-xl`} />
      <div className="flex items-center justify-between"><span className="text-xs font-medium uppercase tracking-wide muted">{label}</span><span className={`grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br ${accent} text-white`}>{icon}</span></div>
      <div className="mt-2 text-3xl font-semibold tabular-nums">{value}</div>
      {hint && <div className="mt-1 text-xs muted">{hint}</div>}
    </div>
  );
}
export const Badge = ({ children, tone }: { children: ReactNode; tone?: string }) => <span className={`chip ${tone ?? statusTone(String(children))}`}>{children}</span>;
export function Drawer({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode }) {
  return (
    <div className={`fixed inset-0 z-50 ${open ? "" : "pointer-events-none"}`}>
      <div onClick={onClose} className={`absolute inset-0 bg-slate-950/50 backdrop-blur-sm transition-opacity ${open ? "opacity-100" : "opacity-0"}`} />
      <aside className={`absolute right-0 top-0 h-full w-full max-w-xl overflow-y-auto border-l border-slate-200 bg-white p-6 shadow-2xl transition-transform dark:border-slate-800 dark:bg-slate-900 ${open ? "translate-x-0" : "translate-x-full"}`}>
        <div className="mb-4 flex items-start justify-between gap-4"><div className="min-w-0">{title}</div><button onClick={onClose} className="rounded-lg p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Close"><X size={18} /></button></div>
        {children}
      </aside>
    </div>
  );
}
export function Field({ label, value }: { label: string; value?: string | number | null }) {
  const v = value == null || value === "" ? null : String(value);
  return (
    <div className="border-b border-slate-100 py-3 dark:border-slate-800">
      <div className="text-[11px] font-semibold uppercase tracking-wide muted">{label}</div>
      {v ? <div className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">{v}</div> : <div className="mt-1 text-sm italic text-amber-600/80 dark:text-amber-400/70">Missing</div>}
    </div>
  );
}
export const Empty = ({ text = "No rows match the current filters." }) => <div className="py-10 text-center text-sm muted">{text}</div>;
