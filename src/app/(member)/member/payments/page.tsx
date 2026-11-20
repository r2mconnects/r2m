import Link from "next/link";
import { and, desc, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import { manualCollections, paymentTransactions } from "@/db/schema";
import { EmptyState, PageHeader, StatusBadge } from "@/components/shared/ui";
import { requireMember } from "@/lib/auth/session";
import { formatDateTime, formatINR, label } from "@/lib/utils";

export const metadata = { title: "Payment history" };

export default async function PaymentsPage() {
  const { user, member } = await requireMember();
  const txns = await db
    .select()
    .from(paymentTransactions)
    .where(and(eq(paymentTransactions.userId, user.id), ne(paymentTransactions.status, "created")))
    .orderBy(desc(paymentTransactions.createdAt));
  const manual = await db.select().from(manualCollections).where(eq(manualCollections.memberId, member.id)).orderBy(desc(manualCollections.createdAt));
  const mine = await db.select().from(paymentTransactions).where(eq(paymentTransactions.memberId, member.id)).orderBy(desc(paymentTransactions.createdAt));
  const rows = Array.from(new Map([...txns, ...mine].map((t) => [t.id, t])).values()).filter((t) => t.status !== "created").sort((a, b) => +b.createdAt - +a.createdAt);
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Payment History" crumbs={[{ label: "Member", href: "/member" }, { label: "Payments" }]} />
      {rows.length === 0 ? <EmptyState title="No payments yet" /> : (
        <div className="card overflow-x-auto !p-0">
          <table className="tbl">
            <thead><tr><th>Date</th><th>Purpose</th><th>Method</th><th>Amount</th><th>Status</th><th>Receipt</th></tr></thead>
            <tbody>
              {rows.map((t) => (
                <tr key={t.id}>
                  <td>{formatDateTime(t.paidAt ?? t.createdAt)}</td>
                  <td>{t.purpose ?? label(t.kind)}</td>
                  <td>{label(t.method)}</td>
                  <td>{formatINR(t.amountPaise)}</td>
                  <td><StatusBadge status={t.status} /></td>
                  <td>{t.receiptNo ? <Link className="link" href={`/member/payments/receipt/${t.id}`}>{t.receiptNo}</Link> : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {manual.length > 0 && (
        <>
          <h2 className="mb-2 mt-5 text-sm font-bold text-navy">Collections recorded by agents / office</h2>
          <div className="card overflow-x-auto !p-0">
            <table className="tbl"><thead><tr><th>Date</th><th>Purpose</th><th>Method</th><th>Amount</th><th>Verification</th></tr></thead>
              <tbody>{manual.map((c) => <tr key={c.id}><td>{formatDateTime(c.createdAt)}</td><td>{label(c.purpose)}</td><td>{label(c.method)}</td><td>{formatINR(c.amountPaise)}</td><td><StatusBadge status={c.status} /></td></tr>)}</tbody></table>
          </div>
        </>
      )}
    </div>
  );
}
