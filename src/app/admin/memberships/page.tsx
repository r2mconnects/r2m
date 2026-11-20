import { count, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { members, membershipCardHistory, membershipCards, membershipPlans } from "@/db/schema";
import { bulkIssueCardsAction } from "@/actions/membership.actions";
import { savePlanAction } from "@/actions/settings.actions";
import { Field } from "@/components/forms/Field";
import { SubmitButton } from "@/components/forms/controls";
import { Flash, PageHeader, StatCard } from "@/components/shared/ui";
import { can, requirePermission } from "@/lib/auth/session";
import { formatDateTime, formatINR, label } from "@/lib/utils";

export const metadata = { title: "Plans & cards" };

export default async function PlansPage({ searchParams }: { searchParams: Promise<{ msg?: string; err?: string }> }) {
  const sp = await searchParams;
  const ctx = await requirePermission("plans", "view");
  const plans = await db.select().from(membershipPlans).orderBy(desc(membershipPlans.createdAt));
  const [cards] = await db.select({ n: count() }).from(membershipCards);
  const [active] = await db.select({ n: count() }).from(members).where(eq(members.status, "active"));
  const hist = await db.select().from(membershipCardHistory).orderBy(desc(membershipCardHistory.createdAt)).limit(15);
  const edit = can(ctx, "plans", "edit");
  const PlanForm = ({ p }: { p?: typeof plans[number] }) => (
    <form action={savePlanAction} className="grid gap-3 sm:grid-cols-4">
      {p && <input type="hidden" name="id" value={p.id} />}
      <Field label="Plan name" name="name" required defaultValue={p?.name} />
      <Field label="Joining fee (₹)" name="joining" type="number" min={0} defaultValue={p ? p.joiningFeePaise / 100 : 0} />
      <Field label="Application fee (₹)" name="application" type="number" min={0} defaultValue={p ? p.applicationFeePaise / 100 : 0} />
      <Field label="Renewal fee (₹)" name="renewal" type="number" min={0} defaultValue={p ? p.renewalFeePaise / 100 : 0} />
      <Field label="Late fee (₹)" name="late" type="number" min={0} defaultValue={p ? p.lateFeePaise / 100 : 0} />
      <Field label="Grace period (days)" name="graceDays" type="number" min={0} defaultValue={p?.graceDays ?? 30} />
      <Field label="Validity (months)" name="validityMonths" type="number" min={1} defaultValue={p?.validityMonths ?? 12} />
      <div className="flex items-end gap-3"><label className="flex items-center gap-1 text-sm"><input type="checkbox" name="active" defaultChecked={p?.active ?? true} /> Active</label><SubmitButton>{p ? "Save" : "Add plan"}</SubmitButton></div>
    </form>
  );
  return (
    <>
      <PageHeader title="Membership Plans & Cards" crumbs={[{ label: "Plans & Cards" }]} />
      <Flash sp={sp} />
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4"><StatCard label="Cards issued" value={cards.n} /><StatCard label="Active members" value={active.n} tone="green" /><StatCard label="Active without card" value={Math.max(0, active.n - cards.n)} tone="amber" /></div>
      {plans.some((p) => p.joiningFeePaise + p.renewalFeePaise === 0) && <p className="mb-3 rounded-lg bg-amber-50 p-2 text-sm text-amber-800">A plan has ₹0 fees. Set real fees below — nothing is hardcoded.</p>}
      <div className="space-y-3">
        {plans.map((p) => (
          <section key={p.id} className="card"><h2 className="mb-2 text-sm font-bold text-navy">{p.name} <span className="font-normal text-slate-500">— joining {formatINR(p.joiningFeePaise + p.applicationFeePaise)}, renewal {formatINR(p.renewalFeePaise)}, {p.validityMonths} months</span></h2>
            {edit ? <PlanForm p={p} /> : null}</section>
        ))}
        {can(ctx, "plans", "create") && <section className="card"><h2 className="mb-2 text-sm font-bold text-navy">Add plan</h2><PlanForm /></section>}
      </div>
      {can(ctx, "cards", "manage") && (
        <form action={bulkIssueCardsAction} className="card mt-4 flex items-center justify-between"><p className="text-sm">Generate cards for every active member who does not have one.</p><SubmitButton confirm="Generate all missing cards?">Bulk-generate cards</SubmitButton></form>
      )}
      <section className="card mt-4 text-xs"><h2 className="mb-1 text-sm font-bold text-navy">Recent card activity</h2>{hist.length === 0 ? <p className="text-slate-500">None yet.</p> : hist.map((h) => <p key={h.id}>{formatDateTime(h.createdAt)} — {label(h.action)} {h.note && `(${h.note})`}</p>)}</section>
    </>
  );
}
