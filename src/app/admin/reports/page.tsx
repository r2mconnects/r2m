import Link from "next/link";
import { and, count, eq, gte, sql } from "drizzle-orm";
import { db } from "@/db";
import { districts, mandals, members, paymentTransactions, userRoles, users, welfareApplications, welfareSchemes } from "@/db/schema";
import { Bars } from "@/components/dashboard/Charts";
import { EmptyState, PageHeader, StatCard, Tabs } from "@/components/shared/ui";
import { can, requirePermission } from "@/lib/auth/session";
import { memberScope } from "@/lib/scope";
import { getSettings } from "@/lib/settings";
import { formatINR, label } from "@/lib/utils";

export const metadata = { title: "Reports" };

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ tab?: string; year?: string }> }) {
  const sp = await searchParams;
  const ctx = await requirePermission("reports", "view");
  const tab = sp.tab ?? "membership";
  const year = parseInt(sp.year ?? "", 10) || new Date().getFullYear();
  const scope = memberScope(ctx);
  const exp = can(ctx, "reports", "export");
  const tabs = [{ key: "membership", label: "Membership" }, { key: "district", label: "District & mandal" }, ...(can(ctx, "payments", "view") ? [{ key: "payments", label: "Payments" }] : []), { key: "agents", label: "Agents" }, ...(can(ctx, "welfare", "view") ? [{ key: "welfare", label: "Welfare" }] : [])];
  let body: React.ReactNode = null;

  if (tab === "membership") {
    const by = await db.select({ s: members.status, n: count() }).from(members).where(scope).groupBy(members.status);
    const total = by.reduce((a, b) => a + b.n, 0);
    const monthly = await db.select({ k: sql<string>`to_char(${members.createdAt},'MM')`, n: count() }).from(members).where(and(scope, gte(members.createdAt, new Date(`${year}-01-01`)), sql`${members.createdAt} < ${new Date(`${year + 1}-01-01`)}`)).groupBy(sql`1`);
    const data = Array.from({ length: 12 }, (_, i) => ({ label: new Date(2000, i, 1).toLocaleString("en", { month: "short" }), value: monthly.find((m) => m.k === String(i + 1).padStart(2, "0"))?.n ?? 0 }));
    body = <><div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4"><StatCard label="Total" value={total} />{by.map((b) => <StatCard key={b.s} label={label(b.s)} value={b.n} tone={b.s === "active" ? "green" : b.s === "rejected" || b.s === "expired" ? "red" : "amber"} />)}</div>
      <section className="card"><h2 className="mb-2 font-bold text-navy">Registrations in {year}</h2><Bars data={data} /></section></>;
  } else if (tab === "district") {
    const rows = await db.select({ d: districts.name, md: mandals.name, n: count(), a: sql<number>`count(*) filter (where ${members.status}='active')::int` }).from(members).innerJoin(districts, eq(districts.id, members.districtId)).leftJoin(mandals, eq(mandals.id, members.mandalId)).where(scope).groupBy(districts.name, mandals.name).orderBy(districts.name, mandals.name);
    body = rows.length === 0 ? <EmptyState title="No data" /> : <div className="card overflow-x-auto !p-0"><table className="tbl"><thead><tr><th>District</th><th>Mandal</th><th>Members</th><th>Active</th></tr></thead><tbody>{rows.map((r, i) => <tr key={i}><td>{r.d}</td><td>{r.md}</td><td>{r.n}</td><td>{r.a}</td></tr>)}</tbody></table></div>;
  } else if (tab === "payments") {
    const rows = await db.select({ k: paymentTransactions.kind, m: paymentTransactions.method, n: count(), s: sql<number>`coalesce(sum(${paymentTransactions.amountPaise}),0)::bigint` }).from(paymentTransactions).where(and(eq(paymentTransactions.status, "paid"), sql`extract(year from ${paymentTransactions.paidAt}) = ${year}`)).groupBy(paymentTransactions.kind, paymentTransactions.method);
    const monthly = await db.select({ k: sql<string>`to_char(${paymentTransactions.paidAt},'MM')`, s: sql<number>`sum(${paymentTransactions.amountPaise})::bigint` }).from(paymentTransactions).where(and(eq(paymentTransactions.status, "paid"), sql`${paymentTransactions.kind} in ('membership_fee','renewal')`, sql`extract(year from ${paymentTransactions.paidAt}) = ${year}`)).groupBy(sql`1`);
    body = <><section className="card mb-4"><h2 className="mb-2 font-bold text-navy">Membership & renewal collections {year} (₹)</h2><Bars prefix="₹" data={Array.from({ length: 12 }, (_, i) => ({ label: new Date(2000, i, 1).toLocaleString("en", { month: "short" }), value: Math.round(Number(monthly.find((m) => m.k === String(i + 1).padStart(2, "0"))?.s ?? 0) / 100) }))} color="#16a34a" /></section>
      {rows.length === 0 ? <EmptyState title="No paid transactions this year" /> : <div className="card overflow-x-auto !p-0"><table className="tbl"><thead><tr><th>Book</th><th>Method</th><th>Count</th><th>Amount</th></tr></thead><tbody>{rows.map((r, i) => <tr key={i}><td>{label(r.k)}</td><td>{label(r.m)}</td><td>{r.n}</td><td>{formatINR(Number(r.s))}</td></tr>)}</tbody></table></div>}
      {exp && <a href={`/api/reports/export?type=payments&year=${year}`} className="btn btn-outline btn-sm mt-3">Export payments CSV</a>}</>;
  } else if (tab === "agents") {
    const s = await getSettings();
    const rows = await db.select({ id: users.id, name: users.fullName, total: count(members.id), active: sql<number>`count(*) filter (where ${members.status}='active')::int`, pending: sql<number>`count(*) filter (where ${members.status} in ('pending','under_review'))::int` }).from(userRoles).innerJoin(users, eq(users.id, userRoles.userId)).leftJoin(members, eq(members.agentId, users.id)).where(eq(userRoles.roleKey, "agent")).groupBy(users.id, users.fullName);
    body = rows.length === 0 ? <EmptyState title="No agents yet" /> : <div className="card overflow-x-auto !p-0"><table className="tbl"><thead><tr><th>Agent</th><th>Registrations</th><th>Approved</th><th>Pending</th>{s.commissionPerRegistrationPaise > 0 && <th>Commission (verified approved)</th>}</tr></thead><tbody>{rows.map((r) => <tr key={r.id}><td><Link className="link" href={`/admin/staff/${r.id}`}>{r.name}</Link></td><td>{r.total}</td><td>{r.active}</td><td>{r.pending}</td>{s.commissionPerRegistrationPaise > 0 && <td>{formatINR(r.active * s.commissionPerRegistrationPaise)}</td>}</tr>)}</tbody></table></div>;
  } else if (tab === "welfare") {
    const rows = await db.select({ n: welfareSchemes.name, s: welfareApplications.status, c: count() }).from(welfareApplications).innerJoin(welfareSchemes, eq(welfareSchemes.id, welfareApplications.schemeId)).groupBy(welfareSchemes.name, welfareApplications.status);
    body = rows.length === 0 ? <EmptyState title="No welfare data" /> : <div className="card overflow-x-auto !p-0"><table className="tbl"><thead><tr><th>Scheme</th><th>Status</th><th>Applications</th></tr></thead><tbody>{rows.map((r, i) => <tr key={i}><td>{r.n}</td><td>{label(r.s)}</td><td>{r.c}</td></tr>)}</tbody></table></div>;
  }

  return (
    <>
      <PageHeader title="Reports & Analytics" subtitle="All figures come from live database records." crumbs={[{ label: "Reports" }]} actions={<>
        <form className="flex items-center gap-1"><input type="hidden" name="tab" value={tab} /><input name="year" type="number" defaultValue={year} className="input w-24" aria-label="Year" /><button className="btn btn-outline btn-sm">Go</button></form>
        {exp && <a href="/api/reports/export?type=members" className="btn btn-outline btn-sm">Members CSV</a>}
        {exp && <a href="/api/reports/export?type=agents" className="btn btn-outline btn-sm">Agents CSV</a>}</>} />
      <Tabs active={tab} base="/admin/reports" tabs={tabs} />
      {body}
    </>
  );
}
