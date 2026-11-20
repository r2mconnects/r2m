import Link from "next/link";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { expenses, manualCollections, members, paymentTransactions, refunds, users, welfareDisbursements } from "@/db/schema";
import { verifyCollectionAction } from "@/actions/membership.actions";
import { addExpenseAction } from "@/actions/settings.actions";
import { Field } from "@/components/forms/Field";
import { SubmitButton } from "@/components/forms/controls";
import { EmptyState, Flash, PageHeader, StatCard, StatusBadge, Tabs } from "@/components/shared/ui";
import { EXPENSE_CATEGORIES } from "@/constants/status";
import { can, requireStaff } from "@/lib/auth/session";
import { formatDate, formatDateTime, formatINR, label } from "@/lib/utils";
import { redirect } from "next/navigation";

export const metadata = { title: "Payments & finance" };

export default async function PaymentsAdmin({ searchParams }: { searchParams: Promise<{ tab?: string; kind?: string; msg?: string; err?: string }> }) {
  const sp = await searchParams;
  const ctx = await requireStaff();
  const finance = can(ctx, "payments", "view");
  const canCol = can(ctx, "collections", "view");
  if (!finance && !canCol) redirect("/unauthorized");
  const tab = sp.tab ?? (finance ? "transactions" : "collections");
  const sum = async (cond: ReturnType<typeof and>) => Number((await db.select({ s: sql<number>`coalesce(sum(${paymentTransactions.amountPaise}),0)::bigint` }).from(paymentTransactions).where(cond))[0].s);
  const paid = (k: string) => and(eq(paymentTransactions.status, "paid"), eq(paymentTransactions.kind, k));
  const stats = finance
    ? {
        fees: await sum(paid("membership_fee")), renew: await sum(paid("renewal")), shop: await sum(paid("shop_order")),
        agent: Number((await db.select({ s: sql<number>`coalesce(sum(${manualCollections.amountPaise}),0)::bigint` }).from(manualCollections).where(eq(manualCollections.status, "verified")))[0].s),
        welfare: Number((await db.select({ s: sql<number>`coalesce(sum(${welfareDisbursements.amountPaise}),0)::bigint` }).from(welfareDisbursements))[0].s),
        refunds: Number((await db.select({ s: sql<number>`coalesce(sum(${refunds.amountPaise}),0)::bigint` }).from(refunds))[0].s),
        exp: Number((await db.select({ s: sql<number>`coalesce(sum(${expenses.amountPaise}),0)::bigint` }).from(expenses))[0].s),
      }
    : null;

  const tabs = [...(finance ? [{ key: "transactions", label: "Transactions" }] : []), ...(canCol ? [{ key: "collections", label: "Manual collections" }] : []), ...(finance ? [{ key: "refunds", label: "Refunds" }, { key: "expenses", label: "Expenses" }] : [])];

  let body: React.ReactNode = null;
  if (tab === "transactions" && finance) {
    const rows = await db
      .select({ t: paymentTransactions, who: members.fullName, no: members.membershipNo })
      .from(paymentTransactions)
      .leftJoin(members, eq(members.id, paymentTransactions.memberId))
      .where(sp.kind ? eq(paymentTransactions.kind, sp.kind) : sql`${paymentTransactions.status} <> 'created'`)
      .orderBy(desc(paymentTransactions.createdAt))
      .limit(200);
    body = (
      <>
        <div className="mb-2 flex gap-2 text-xs">{[["", "All"], ["membership_fee", "Membership fees"], ["renewal", "Renewals"], ["shop_order", "Shop (separate books)"]].map(([k, v]) => <Link key={k} href={`/admin/payments?tab=transactions${k ? `&kind=${k}` : ""}`} className={`rounded-full border px-3 py-1 font-semibold ${(sp.kind ?? "") === k ? "bg-navy text-white" : "bg-white text-navy"}`}>{v}</Link>)}</div>
        {rows.length === 0 ? <EmptyState title="No transactions yet" /> : (
          <div className="card overflow-x-auto !p-0"><table className="tbl"><thead><tr><th>Date</th><th>Member</th><th>Type</th><th>Method</th><th>Amount</th><th>Status</th><th>Receipt</th></tr></thead>
            <tbody>{rows.map(({ t, who, no }) => <tr key={t.id}><td>{formatDateTime(t.paidAt ?? t.createdAt)}</td><td>{who ?? "—"} <span className="text-[11px] text-slate-400">{no}</span></td><td>{label(t.kind)}</td><td>{label(t.method)}</td><td>{formatINR(t.amountPaise)}</td><td><StatusBadge status={t.status} /></td><td>{t.receiptNo ?? "—"}</td></tr>)}</tbody></table></div>
        )}
      </>
    );
  } else if (tab === "collections" && canCol) {
    const agent = users;
    const rows = await db
      .select({ c: manualCollections, who: members.fullName, by: agent.fullName })
      .from(manualCollections)
      .innerJoin(members, eq(members.id, manualCollections.memberId))
      .innerJoin(agent, eq(agent.id, manualCollections.collectedBy))
      .orderBy(desc(manualCollections.createdAt))
      .limit(200);
    const canVerify = can(ctx, "collections", "approve");
    body = rows.length === 0 ? <EmptyState title="No manual collections" hint="Agents record cash/UPI collections from a member's profile; finance verifies them here." /> : (
      <div className="card overflow-x-auto !p-0"><table className="tbl"><thead><tr><th>Date</th><th>Member</th><th>Collected by</th><th>Purpose</th><th>Method / ref</th><th>Amount</th><th>Status</th>{canVerify && <th></th>}</tr></thead>
        <tbody>{rows.map(({ c, who, by }) => (
          <tr key={c.id}><td>{formatDateTime(c.createdAt)}</td><td>{who}</td><td>{by}</td><td>{label(c.purpose)}</td><td>{label(c.method)} {c.reference}</td><td>{formatINR(c.amountPaise)}</td><td><StatusBadge status={c.status} /></td>
            {canVerify && <td>{c.status === "pending" && (
              <form action={verifyCollectionAction} className="flex items-center gap-1"><input type="hidden" name="id" value={c.id} />
                <button name="verdict" value="approve" className="btn btn-success btn-sm">Verify</button>
                {can(ctx, "collections", "reject") && <><input name="reason" placeholder="Reason" className="input !min-h-8 w-24 !py-1 text-xs" /><button name="verdict" value="reject" className="btn btn-danger btn-sm">Reject</button></>}
              </form>)}</td>}
          </tr>))}</tbody></table></div>
    );
  } else if (tab === "refunds" && finance) {
    const rows = await db.select().from(refunds).orderBy(desc(refunds.createdAt)).limit(100);
    body = rows.length === 0 ? <EmptyState title="No refunds" /> : <div className="card overflow-x-auto !p-0"><table className="tbl"><thead><tr><th>Date</th><th>Amount</th><th>Method</th><th>Reason</th><th>Reference</th></tr></thead><tbody>{rows.map((r) => <tr key={r.id}><td>{formatDateTime(r.createdAt)}</td><td>{formatINR(r.amountPaise)}</td><td>{label(r.method)}</td><td>{r.reason ?? "—"}</td><td>{r.reference ?? r.gatewayRefundId ?? "—"}</td></tr>)}</tbody></table></div>;
  } else if (tab === "expenses" && finance) {
    const rows = await db.select().from(expenses).orderBy(desc(expenses.spentOn)).limit(100);
    body = (
      <>
        {can(ctx, "payments", "manage") && (
          <form action={addExpenseAction} className="card mb-3 grid gap-3 sm:grid-cols-5">
            <Field label="Category" name="category" options={EXPENSE_CATEGORIES.map((c) => ({ value: c, label: c }))} required />
            <Field label="Amount (₹)" name="amount" type="number" min={1} required />
            <Field label="Date" name="spentOn" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} />
            <Field label="Description" name="description" />
            <div className="flex items-end"><SubmitButton>Add expense</SubmitButton></div>
          </form>
        )}
        {rows.length === 0 ? <EmptyState title="No expenses recorded" /> : <div className="card overflow-x-auto !p-0"><table className="tbl"><thead><tr><th>Date</th><th>Category</th><th>Description</th><th>Amount</th></tr></thead><tbody>{rows.map((r) => <tr key={r.id}><td>{formatDate(r.spentOn)}</td><td>{r.category}</td><td>{r.description}</td><td>{formatINR(r.amountPaise)}</td></tr>)}</tbody></table></div>}
      </>
    );
  }

  return (
    <>
      <PageHeader title="Payments & Finance" subtitle="Membership fees, shop sales and welfare funds are kept in separate books." crumbs={[{ label: "Payments" }]} />
      <Flash sp={sp} />
      {stats && (
        <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
          <StatCard label="Membership fees" value={formatINR(stats.fees)} tone="green" /><StatCard label="Renewals" value={formatINR(stats.renew)} tone="green" />
          <StatCard label="Product sales" value={formatINR(stats.shop)} tone="purple" /><StatCard label="Agent collections (verified)" value={formatINR(stats.agent)} />
          <StatCard label="Welfare disbursed" value={formatINR(stats.welfare)} tone="amber" /><StatCard label="Refunds" value={formatINR(stats.refunds)} tone="red" /><StatCard label="Expenses" value={formatINR(stats.exp)} tone="red" />
        </div>
      )}
      <Tabs active={tab} base="/admin/payments" tabs={tabs} />
      {body}
    </>
  );
}
