import Link from "next/link";
import { and, count, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { districts, members, mandals, paymentTransactions } from "@/db/schema";
import { reviewApplicationAction } from "@/actions/membership.actions";
import { SubmitButton } from "@/components/forms/controls";
import { EmptyState, Flash, PageHeader, StatusBadge, Tabs } from "@/components/shared/ui";
import { can, requirePermission } from "@/lib/auth/session";
import { applicationFee } from "@/lib/membership/membership";
import { memberScope } from "@/lib/scope";
import { getSettings } from "@/lib/settings";
import { formatDate, formatINR } from "@/lib/utils";

export const metadata = { title: "Applications" };

export default async function ApplicationsPage({ searchParams }: { searchParams: Promise<{ tab?: string; msg?: string; err?: string }> }) {
  const sp = await searchParams;
  const tab = sp.tab ?? "pending";
  const ctx = await requirePermission("applications", "view");
  const s = await getSettings();
  const scope = memberScope(ctx);
  const cnt = async (st: string[]) => (await db.select({ n: count() }).from(members).where(and(scope, inArray(members.status, st))))[0].n;
  const [cp, cu, ca, cr] = await Promise.all([cnt(["pending"]), cnt(["under_review"]), cnt(["active", "expired", "suspended"]), cnt(["rejected"])]);
  const statuses = tab === "review" ? ["under_review"] : tab === "approved" ? ["active", "expired", "suspended"] : tab === "rejected" ? ["rejected"] : ["pending"];
  const rows = await db
    .select({ m: members, d: districts.name, md: mandals.name })
    .from(members)
    .leftJoin(districts, eq(districts.id, members.districtId))
    .leftJoin(mandals, eq(mandals.id, members.mandalId))
    .where(and(scope, inArray(members.status, statuses)))
    .orderBy(desc(members.createdAt))
    .limit(100);
  const feeInfo = new Map<string, Awaited<ReturnType<typeof applicationFee>>>();
  const paidMap = new Set<string>();
  if (rows.length) {
    for (const { m } of rows) feeInfo.set(m.id, await applicationFee(m.id, m.planId));
    const paid = await db.select({ id: paymentTransactions.memberId }).from(paymentTransactions).where(and(eq(paymentTransactions.status, "paid"), eq(paymentTransactions.kind, "membership_fee")));
    paid.forEach((p) => p.id && paidMap.add(p.id));
  }
  const canApprove = can(ctx, "applications", "approve");
  const canReject = can(ctx, "applications", "reject");
  return (
    <>
      <PageHeader title="Applications & Approvals" crumbs={[{ label: "Applications" }, { label: "Registration Approvals" }]} subtitle={`Payment policy: ${s.paymentPolicy === "before_approval" ? "fee required before approval" : "fee paid after preliminary approval"} (change in Settings).`} />
      <Flash sp={sp} />
      <Tabs active={tab} base="/admin/applications" tabs={[{ key: "pending", label: "Pending", count: cp }, { key: "review", label: "Under Review", count: cu }, { key: "approved", label: "Approved", count: ca }, { key: "rejected", label: "Rejected", count: cr }]} />
      {rows.length === 0 ? <EmptyState title="Nothing here" hint="New registrations will appear in Pending." /> : (
        <div className="card overflow-x-auto !p-0">
          <table className="tbl">
            <thead><tr><th>Applicant</th><th>District / Mandal</th><th>Applied</th><th>Fee</th><th>Status</th>{(canApprove || canReject) && <th>Actions</th>}</tr></thead>
            <tbody>
              {rows.map(({ m, d, md }) => {
                const fee = feeInfo.get(m.id)!;
                const open = ["pending", "under_review"].includes(m.status);
                return (
                  <tr key={m.id}>
                    <td><Link href={`/admin/members/${m.id}`} className="link">{m.fullName}</Link><span className="block text-[11px] text-slate-500">{m.applicationRef} • {m.mobile}{m.agentId ? " • via agent" : ""}</span></td>
                    <td>{d} / {md}</td><td>{formatDate(m.createdAt)}</td>
                    <td>{fee.amountPaise === 0 ? "No fee" : paidMap.has(m.id) ? <StatusBadge status="paid" /> : <span className="text-amber-700">Due {formatINR(fee.amountPaise)}</span>}</td>
                    <td><StatusBadge status={m.status} /></td>
                    {(canApprove || canReject) && (
                      <td>
                        {open ? (
                          <form action={reviewApplicationAction} className="flex flex-wrap items-center gap-1">
                            <input type="hidden" name="id" value={m.id} /><input type="hidden" name="back" value={`/admin/applications?tab=${tab}`} />
                            {canApprove && m.status === "pending" && <button name="decision" value="preliminary" className="btn btn-outline btn-sm">Pre-approve</button>}
                            {canApprove && <SubmitButtonDecision value="approve" confirm="Approve and activate this membership? A membership number will be generated." />}
                            {canReject && (<><input name="reason" placeholder="Reject reason" className="input !min-h-8 w-32 !py-1 text-xs" /><button name="decision" value="reject" className="btn btn-danger btn-sm">Reject</button></>)}
                          </form>
                        ) : <span className="text-xs text-slate-500">{m.membershipNo ?? m.rejectReason}</span>}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function SubmitButtonDecision({ value, confirm }: { value: string; confirm: string }) {
  void confirm;
  return <button name="decision" value={value} className="btn btn-success btn-sm">Approve</button>;
}
void SubmitButton;
