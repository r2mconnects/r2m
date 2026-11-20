import Link from "next/link";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { districts, mandals, members } from "@/db/schema";
import { EmptyState, PageHeader, StatusBadge } from "@/components/shared/ui";
import { requirePermission } from "@/lib/auth/session";
import { memberScope } from "@/lib/scope";

export const metadata = { title: "Workshops" };

export default async function WorkshopsAdmin() {
  const ctx = await requirePermission("workshops", "view");
  const rows = await db
    .select({ m: members, d: districts.name, md: mandals.name })
    .from(members)
    .leftJoin(districts, eq(districts.id, members.districtId))
    .leftJoin(mandals, eq(mandals.id, members.mandalId))
    .where(and(memberScope(ctx), eq(members.directoryOptIn, true)))
    .orderBy(desc(members.createdAt));
  return (
    <>
      <PageHeader title="Workshop Directory" subtitle="Members who opted in. Only verified listings are visible to other members — verify from the member profile." crumbs={[{ label: "Workshops" }]} />
      {rows.length === 0 ? <EmptyState title="No opted-in workshops" /> : (
        <div className="card overflow-x-auto !p-0"><table className="tbl"><thead><tr><th>Workshop</th><th>Mechanic</th><th>District / Mandal</th><th>Services</th><th>Listing</th><th></th></tr></thead>
          <tbody>{rows.map(({ m, d, md }) => <tr key={m.id}><td className="font-semibold">{m.workshopName}</td><td>{m.fullName}</td><td>{d} / {md}</td><td>{m.services ?? "—"}</td><td><StatusBadge status={m.directoryVerified && m.status === "active" ? "verified" : "pending"} text={m.directoryVerified ? (m.status === "active" ? "Verified & public" : "Verified (inactive member)") : "Awaiting verification"} /></td><td><Link className="btn btn-outline btn-sm" href={`/admin/members/${m.id}`}>Review</Link></td></tr>)}</tbody></table></div>
      )}
    </>
  );
}
