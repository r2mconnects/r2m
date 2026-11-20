import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { membershipRenewals } from "@/db/schema";
import { EmptyState, PageHeader, StatusBadge } from "@/components/shared/ui";
import { requireMember } from "@/lib/auth/session";
import { getMemberFull } from "@/lib/data/members";
import { formatDate, formatINR, label } from "@/lib/utils";

export const metadata = { title: "Membership" };

export default async function MembershipPage() {
  const { member: m } = await requireMember();
  const full = await getMemberFull(m.id);
  const hist = await db.select().from(membershipRenewals).where(eq(membershipRenewals.memberId, m.id)).orderBy(desc(membershipRenewals.createdAt));
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Membership Details" crumbs={[{ label: "Member", href: "/member" }, { label: "Membership" }]} actions={<><Link href="/member/membership/card" className="btn btn-primary btn-sm">ID Card</Link><Link href="/member/membership/renewal" className="btn btn-accent btn-sm">Renew</Link></>} />
      <section className="card grid gap-2 text-sm sm:grid-cols-2">
        <p><b>Membership No:</b> {m.membershipNo ?? "Awaiting approval"}</p>
        <p><b>Application ref:</b> {m.applicationRef}</p>
        <p><b>Status:</b> <StatusBadge status={m.status} /></p>
        <p><b>Category:</b> Mechanic</p>
        <p><b>Valid from:</b> {formatDate(m.validFrom)}</p>
        <p><b>Valid till:</b> {formatDate(m.validTill)}</p>
        <p><b>District / Mandal:</b> {full?.district} / {full?.mandal}</p>
        <p><b>Approved on:</b> {formatDate(m.approvedAt)}</p>
      </section>
      <h2 className="mb-2 mt-4 text-sm font-bold text-navy">Membership history</h2>
      {hist.length === 0 ? <EmptyState title="No membership periods yet" hint="Your history appears after your application is approved." /> : (
        <div className="card overflow-x-auto !p-0">
          <table className="tbl"><thead><tr><th>Type</th><th>From</th><th>To</th><th>Amount</th></tr></thead>
            <tbody>{hist.map((h) => <tr key={h.id}><td>{label(h.kind)}</td><td>{formatDate(h.fromDate)}</td><td>{formatDate(h.toDate)}</td><td>{formatINR(h.amountPaise)}</td></tr>)}</tbody></table>
        </div>
      )}
    </div>
  );
}
