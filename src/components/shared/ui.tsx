import Link from "next/link";
import type { ReactNode } from "react";
import { CheckCircle2, AlertCircle, Inbox } from "lucide-react";
import { label, statusTone } from "@/constants/status";
import { cn } from "@/lib/cn";

export function StatusBadge({ status, text }: { status: string; text?: string }) {
  return <span className={cn("badge", statusTone(status))}>{text ?? label(status)}</span>;
}

export function Flash({ sp }: { sp: { msg?: string; err?: string } }) {
  if (sp.msg)
    return (
      <div role="status" className="mb-4 flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
        <CheckCircle2 size={18} className="mt-0.5 shrink-0" /> <span>{sp.msg}</span>
      </div>
    );
  if (sp.err)
    return (
      <div role="alert" className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
        <AlertCircle size={18} className="mt-0.5 shrink-0" /> <span>{sp.err}</span>
      </div>
    );
  return null;
}

export function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white px-4 py-10 text-center">
      <Inbox className="mb-2 text-slate-400" size={28} />
      <p className="text-sm font-semibold text-slate-700">{title}</p>
      {hint && <p className="mt-1 max-w-sm text-xs text-slate-500">{hint}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  crumbs,
  actions,
}: {
  title: string;
  subtitle?: string;
  crumbs?: Array<{ label: string; href?: string }>;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        {crumbs && (
          <nav aria-label="Breadcrumb" className="mb-1 flex flex-wrap items-center gap-1 text-xs text-slate-500">
            {crumbs.map((c, i) => (
              <span key={i} className="flex items-center gap-1">
                {c.href ? (
                  <Link href={c.href} className="hover:text-royal hover:underline">
                    {c.label}
                  </Link>
                ) : (
                  <span>{c.label}</span>
                )}
                {i < crumbs.length - 1 && <span>/</span>}
              </span>
            ))}
          </nav>
        )}
        <h1 className="h-title">{title}</h1>
        {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Tabs({ tabs, active, base }: { tabs: Array<{ key: string; label: string; count?: number }>; active: string; base: string }) {
  return (
    <div className="mb-4 flex gap-1 overflow-x-auto rounded-lg bg-white p-1 shadow-sm ring-1 ring-slate-200">
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={`${base}${base.includes("?") ? "&" : "?"}tab=${t.key}`}
          className={cn(
            "whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-semibold",
            active === t.key ? "bg-navy text-white" : "text-navy hover:bg-slate-100",
          )}
        >
          {t.label}
          {t.count !== undefined && <span className="ml-1 opacity-70">({t.count})</span>}
        </Link>
      ))}
    </div>
  );
}

export function StatCard({ label: l, value, hint, tone = "navy" }: { label: string; value: ReactNode; hint?: string; tone?: "navy" | "green" | "amber" | "red" | "purple" }) {
  const bar = { navy: "bg-royal", green: "bg-green-500", amber: "bg-amber-500", red: "bg-red-500", purple: "bg-purple-500" }[tone];
  return (
    <div className="card relative overflow-hidden !p-3">
      <span className={cn("absolute inset-y-0 left-0 w-1", bar)} />
      <p className="pl-1 text-xs font-medium text-slate-500">{l}</p>
      <p className="pl-1 text-xl font-bold text-ink md:text-2xl">{value}</p>
      {hint && <p className="pl-1 text-[11px] text-slate-400">{hint}</p>}
    </div>
  );
}

export function Avatar({ src, name, size = 40 }: { src?: string | null; name: string; size?: number }) {
  const initials = name.split(" ").filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase()).join("");
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={name} width={size} height={size} className="rounded-full object-cover" style={{ width: size, height: size }} />
  ) : (
    <span
      className="inline-flex items-center justify-center rounded-full bg-royal font-bold text-white"
      style={{ width: size, height: size, fontSize: size / 2.6 }}
      aria-label={name}
    >
      {initials || "?"}
    </span>
  );
}
