import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { welfareApplications, welfareSchemes } from "@/db/schema";
import { EmptyState, Flash, PageHeader, StatusBadge } from "@/components/shared/ui";
import { requireMember } from "@/lib/auth/session";
import { WELFARE_STATUS_LABEL } from "@/constants/status";
import { formatDate, formatINR } from "@/lib/utils";

export const metadata = { title: "Welfare" };

export default async function WelfarePage({ searchParams }: { searchParams: Promise<{ msg?: string; err?: string }> }) {
  const sp = await searchParams;
  const { member } = await requireMember();
  const [schemes, apps] = await Promise.all([
    db.select().from(welfareSchemes).where(eq(welfareSchemes.active, true)),
    db
      .select({ w: welfareApplications, scheme: welfareSchemes.name })
      .from(welfareApplications)
      .innerJoin(welfareSchemes, eq(welfareSchemes.id, welfareApplications.schemeId))
      .where(eq(welfareApplications.memberId, member.id))
      .orderBy(desc(welfareApplications.createdAt)),
  ]);
  return (
    <>
      <PageHeader title="Welfare Services" crumbs={[{ label: "Home", href: "/home" }, { label: "Welfare" }]} actions={<Link href="/welfare/apply" className="btn btn-primary btn-sm">Apply for welfare</Link>} />
      <Flash sp={sp} />
      <h2 className="mb-2 text-sm font-bold text-navy">Available schemes</h2>
      <div className="mb-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {schemes.map((s) => (
          <div key={s.id} className="card !p-3">
            <p className="font-semibold text-navy">{s.name}</p>
            <p className="line-clamp-2 text-xs text-slate-500">{s.description}</p>
            {s.maxAmountPaise && <p className="mt-1 text-xs">Up to {formatINR(s.maxAmountPaise)}</p>}
          </div>
        ))}
      </div>
      <h2 className="mb-2 text-sm font-bold text-navy">My applications</h2>
      {apps.length === 0 ? <EmptyState title="No applications yet" action={<Link href="/welfare/apply" className="btn btn-primary btn-sm">Apply now</Link>} /> : (
        <div className="card overflow-x-auto !p-0">
          <table className="tbl"><thead><tr><th>Reference</th><th>Scheme</th><th>Applied</th><th>Requested</th><th>Status</th></tr></thead>
            <tbody>{apps.map(({ w, scheme }) => (
              <tr key={w.id}><td><Link className="link" href={`/welfare/${w.id}`}>{w.refNo}</Link></td><td>{scheme}</td><td>{formatDate(w.createdAt)}</td><td>{w.requestedPaise ? formatINR(w.requestedPaise) : "—"}</td><td><StatusBadge status={w.status} text={WELFARE_STATUS_LABEL[w.status]} /></td></tr>
            ))}</tbody></table>
        </div>
      )}
    </>
  );
}
