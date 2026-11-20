import Link from "next/link";
import { and, count, desc, eq, gte, inArray, lte, sql, sum } from "drizzle-orm";
import { db } from "@/db";
import {
  districts, manualCollections, members, orders, paymentTransactions, userRoles, welfareApplications, welfareDisbursements, welfareSchemes,
} from "@/db/schema";
import { AreaTrend, Donut } from "@/components/dashboard/Charts";
import { EmptyState, Flash, PageHeader, StatCard, StatusBadge } from "@/components/shared/ui";
import { can, requireStaff } from "@/lib/auth/session";
import { syncExpiry } from "@/lib/membership/membership";
import { memberScope } from "@/lib/scope";
import { formatDate, formatINR } from "@/lib/utils";

export const metadata = { title: "Dashboard" };

export default async function AdminDashboard({ searchParams }: { searchParams: Promise<{ msg?: string; err?: string }> }) {
  const sp = await searchParams;
  const ctx = await requireStaff();
  await syncExpiry();
  const scope = memberScope(ctx);
  const cnt = async (extra?: ReturnType<typeof eq>) => (await db.select({ n: count() }).from(members).where(and(scope, extra)))[0].n;
  const in30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);
  const canMembers = can(ctx, "members", "view") || can(ctx, "applications", "view");

  const [total, active, pending, expired, renewals] = canMembers
    ? await Promise.all([
        cnt(),
        cnt(eq(members.status, "active")),
        cnt(inArray(members.status, ["pending", "under_review"]) as never),
        cnt(eq(members.status, "expired")),
        cnt(and(eq(members.status, "active"), gte(members.validTill, today), lte(members.validTill, in30)) as never),
      ])
    : [0, 0, 0, 0, 0];

  const since = new Date();
  since.setMonth(since.getMonth() - 5, 1);
  since.setHours(0, 0, 0, 0);
  const regs = canMembers
    ? await db
        .select({ m: sql<string>`to_char(date_trunc('month', ${members.createdAt}), 'YYYY-MM')`, n: count() })
        .from(members)
        .where(and(scope, gte(members.createdAt, since)))
        .groupBy(sql`1`)
    : [];
  const trend = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(since.getFullYear(), since.getMonth() + i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    return { label: d.toLocaleString("en", { month: "short" }), value: regs.find((r) => r.m === key)?.n ?? 0 };
  });

  const byDistrict = canMembers
    ? await db
        .select({ name: districts.name, n: count() })
        .from(members)
        .innerJoin(districts, eq(districts.id, members.districtId))
        .where(scope)
        .groupBy(districts.name)
        .orderBy(desc(count()))
    : [];

  const recentApps = canMembers
    ? await db
        .select({ m: members, d: districts.name })
        .from(members)
        .leftJoin(districts, eq(districts.id, members.districtId))
        .where(and(scope, inArray(members.status, ["pending", "under_review"])))
        .orderBy(desc(members.createdAt))
        .limit(5)
    : [];

  const finance = can(ctx, "payments", "view");
  const [membershipSum] = finance
    ? await db.select({ s: sum(paymentTransactions.amountPaise) }).from(paymentTransactions).where(and(eq(paymentTransactions.status, "paid"), inArray(paymentTransactions.kind, ["membership_fee", "renewal"])))
    : [{ s: null }];
  const [pendingCol] = finance || can(ctx, "collections", "view")
    ? await db.select({ s: sum(manualCollections.amountPaise) }).from(manualCollections).where(eq(manualCollections.status, "pending"))
    : [{ s: null }];

  const shop = can(ctx, "orders", "view");
  const [shopStats] = shop
    ? await db.select({ n: count(), s: sum(sql`case when ${orders.paymentStatus} = 'paid' then ${orders.totalPaise} else 0 end`) }).from(orders)
    : [{ n: 0, s: null }];
  const recentOrders = shop ? await db.select().from(orders).orderBy(desc(orders.createdAt)).limit(5) : [];

  const welfare = can(ctx, "welfare", "view");
  const welfarePending = welfare
    ? await db
        .select({ name: welfareSchemes.name, n: count() })
        .from(welfareApplications)
        .innerJoin(welfareSchemes, eq(welfareSchemes.id, welfareApplications.schemeId))
        .where(inArray(welfareApplications.status, ["submitted", "under_review", "more_info", "recommended", "payment_pending"]))
        .groupBy(welfareSchemes.name)
    : [];
  const [disb] = welfare ? await db.select({ s: sum(welfareDisbursements.amountPaise) }).from(welfareDisbursements) : [{ s: null }];

  const staffCount = can(ctx, "staff", "view")
    ? (await db.select({ n: count() }).from(userRoles).where(and(eq(userRoles.active, true), sql`${userRoles.roleKey} <> 'member'`)))[0].n
    : null;
  const agents = can(ctx, "staff", "view") ? (await db.select({ n: count() }).from(userRoles).where(and(eq(userRoles.active, true), eq(userRoles.roleKey, "agent"))))[0].n : null;

  const quick = [
    { label: "Add Member", href: "/admin/members/new", ok: can(ctx, "members", "create") },
    { label: "Add Staff / Agent", href: "/admin/staff/new", ok: can(ctx, "staff", "create") },
    { label: "Add Product", href: "/admin/shop/products?new=1", ok: can(ctx, "shop", "create") },
    { label: "Publish News", href: "/admin/news?new=1", ok: can(ctx, "news", "create") },
    { label: "Create Event", href: "/admin/events?new=1", ok: can(ctx, "events", "create") },
    { label: "Manage Payments", href: "/admin/payments", ok: can(ctx, "payments", "view") || can(ctx, "collections", "view") },
  ].filter((q) => q.ok);

  return (
    <>
      <PageHeader title="Admin Dashboard" subtitle={ctx.scope.global ? "Overview of members, payments, welfare and shop activities" : "Overview for your assigned area"} />
      <Flash sp={sp} />
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {canMembers && <><StatCard label="Total Members" value={total} /><StatCard label="Active Members" value={active} tone="green" /><StatCard label="Pending Approvals" value={pending} tone="amber" /><StatCard label="Expired" value={expired} tone="red" /><StatCard label="Renewals Due (30d)" value={renewals} tone="purple" /></>}
        {staffCount !== null && <StatCard label="Staff / Agents" value={`${staffCount} / ${agents}`} />}
        {finance && <StatCard label="Membership Collections" value={formatINR(Number(membershipSum.s ?? 0))} hint={`Pending verification: ${formatINR(Number(pendingCol.s ?? 0))}`} tone="green" />}
        {shop && <><StatCard label="Shop Orders" value={shopStats.n} tone="purple" /><StatCard label="Product Sales" value={formatINR(Number(shopStats.s ?? 0))} hint="Paid orders only" tone="green" /></>}
        {welfare && <StatCard label="Welfare Disbursed" value={formatINR(Number(disb.s ?? 0))} tone="amber" />}
      </div>

      {canMembers && (
        <div className="mb-4 grid gap-4 lg:grid-cols-3">
          <section className="card lg:col-span-1"><h2 className="mb-2 font-bold text-navy">Membership Registrations</h2><AreaTrend data={trend} /></section>
          <section className="card lg:col-span-1"><h2 className="mb-2 font-bold text-navy">Members by District</h2>{byDistrict.length === 0 ? <EmptyState title="No members yet" /> : <Donut data={byDistrict.map((d) => ({ name: d.name, value: d.n }))} total={byDistrict.reduce((a, d) => a + d.n, 0)} />}</section>
          <section className="card">
            <h2 className="mb-2 font-bold text-navy">Quick Actions</h2>
            <div className="grid gap-2">{quick.map((q) => <Link key={q.href} href={q.href} className="btn btn-outline justify-start">+ {q.label}</Link>)}</div>
          </section>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {canMembers && (
          <section className="card overflow-x-auto lg:col-span-1">
            <div className="mb-2 flex justify-between"><h2 className="font-bold text-navy">Recent Applications</h2><Link href="/admin/applications" className="link text-xs">View all</Link></div>
            {recentApps.length === 0 ? <EmptyState title="No pending applications" /> : (
              <table className="tbl"><thead><tr><th>Name</th><th>District</th><th>Applied</th><th>Status</th></tr></thead>
                <tbody>{recentApps.map(({ m, d }) => <tr key={m.id}><td><Link className="link" href={`/admin/members/${m.id}`}>{m.fullName}</Link></td><td>{d}</td><td>{formatDate(m.createdAt)}</td><td><StatusBadge status={m.status} /></td></tr>)}</tbody></table>
            )}
          </section>
        )}
        {shop && (
          <section className="card overflow-x-auto lg:col-span-1">
            <div className="mb-2 flex justify-between"><h2 className="font-bold text-navy">Recent Orders</h2><Link href="/admin/shop/orders" className="link text-xs">View all</Link></div>
            {recentOrders.length === 0 ? <EmptyState title="No orders yet" /> : (
              <table className="tbl"><thead><tr><th>Order</th><th>Amount</th><th>Status</th></tr></thead>
                <tbody>{recentOrders.map((o) => <tr key={o.id}><td><Link className="link" href={`/admin/shop/orders?open=${o.id}`}>{o.orderNo}</Link></td><td>{formatINR(o.totalPaise)}</td><td><StatusBadge status={o.status} /></td></tr>)}</tbody></table>
            )}
          </section>
        )}
        {welfare && (
          <section className="card lg:col-span-1">
            <div className="mb-2 flex justify-between"><h2 className="font-bold text-navy">Welfare Requests</h2><Link href="/admin/welfare" className="link text-xs">View all</Link></div>
            {welfarePending.length === 0 ? <EmptyState title="No pending welfare requests" /> : <ul className="space-y-2 text-sm">{welfarePending.map((w) => <li key={w.name} className="flex justify-between"><span>{w.name}</span><span className="font-semibold text-amber-600">{w.n} pending</span></li>)}</ul>}
          </section>
        )}
      </div>
    </>
  );
}
