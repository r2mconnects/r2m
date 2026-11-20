import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { bloodDonors, bloodRequests, districts, members } from "@/db/schema";
import { EmptyState, PageHeader, StatusBadge } from "@/components/shared/ui";
import { requirePermission } from "@/lib/auth/session";
import { memberScope } from "@/lib/scope";
import { formatDate } from "@/lib/utils";
import { and } from "drizzle-orm";

export const metadata = { title: "Blood donors" };

export default async function DonorsAdmin() {
  const ctx = await requirePermission("donors", "view");
  const donors = await db
    .select({ d: bloodDonors, m: members, dist: districts.name })
    .from(bloodDonors)
    .innerJoin(members, eq(members.id, bloodDonors.memberId))
    .leftJoin(districts, eq(districts.id, bloodDonors.districtId))
    .where(and(memberScope(ctx)))
    .orderBy(desc(bloodDonors.createdAt));
  const reqs = await db.select().from(bloodRequests).orderBy(desc(bloodRequests.createdAt)).limit(30);
  return (
    <>
      <PageHeader title="Blood Donor Management" crumbs={[{ label: "Blood Donors" }]} />
      {donors.length === 0 ? <EmptyState title="No donors registered" /> : (
        <div className="card mb-6 overflow-x-auto !p-0"><table className="tbl"><thead><tr><th>Donor</th><th>Group</th><th>District</th><th>Area</th><th>Mobile (staff only)</th><th>Availability</th></tr></thead>
          <tbody>{donors.map(({ d, m, dist }) => <tr key={d.id}><td>{m.fullName}</td><td className="font-semibold">{d.bloodGroup}</td><td>{dist}</td><td>{d.location ?? "—"}</td><td>{m.mobile}</td><td><StatusBadge status={d.available ? "active" : "suspended"} text={d.available ? "Available" : "Unavailable"} /></td></tr>)}</tbody></table></div>
      )}
      <h2 className="mb-2 text-sm font-bold text-navy">Blood requests</h2>
      {reqs.length === 0 ? <EmptyState title="No requests" /> : <div className="card overflow-x-auto !p-0"><table className="tbl"><thead><tr><th>Date</th><th>Group</th><th>Units</th><th>Hospital</th><th>Contact</th><th>Status</th></tr></thead><tbody>{reqs.map((r) => <tr key={r.id}><td>{formatDate(r.createdAt)}</td><td className="font-semibold">{r.bloodGroup}</td><td>{r.units}</td><td>{r.hospital}</td><td>{r.contactPhone}</td><td><StatusBadge status={r.status} /></td></tr>)}</tbody></table></div>}
    </>
  );
}
