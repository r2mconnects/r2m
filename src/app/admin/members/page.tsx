import Link from "next/link";
import { and, count, desc, eq, gte, ilike, lte, or } from "drizzle-orm";
import { Download, Eye } from "lucide-react";
import { db } from "@/db";
import { districts, mandals, members } from "@/db/schema";
import { GeoSelect } from "@/components/forms/controls";
import { EmptyState, Flash, PageHeader, StatusBadge } from "@/components/shared/ui";
import { can, requirePermission } from "@/lib/auth/session";
import { getDistricts, getMandals } from "@/lib/data/geo";
import { memberScope } from "@/lib/scope";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Members" };
const PAGE = 30;

export default async function MembersPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const ctx = await requirePermission("members", "view");
  const [ds, ms] = await Promise.all([getDistricts(), getMandals()]);
  const conds = [memberScope(ctx)];
  if (sp.q) {
    const q = `%${sp.q}%`;
    conds.push(or(ilike(members.fullName, q), ilike(members.mobile, q), ilike(members.membershipNo, q), ilike(members.workshopName, q), ilike(members.applicationRef, q)));
  }
  if (sp.status) conds.push(eq(members.status, sp.status));
  if (sp.districtId) conds.push(eq(members.districtId, sp.districtId));
  if (sp.mandalId) conds.push(eq(members.mandalId, sp.mandalId));
  if (sp.from) conds.push(gte(members.createdAt, new Date(sp.from)));
  if (sp.to) conds.push(lte(members.createdAt, new Date(sp.to + "T23:59:59")));
  if (sp.renewal === "due") {
    const today = new Date().toISOString().slice(0, 10);
    conds.push(and(eq(members.status, "active"), lte(members.validTill, new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)), gte(members.validTill, today)));
  }
  const where = and(...conds);
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const [{ n }] = await db.select({ n: count() }).from(members).where(where);
  const rows = await db
    .select({ m: members, d: districts.name, md: mandals.name })
    .from(members)
    .leftJoin(districts, eq(districts.id, members.districtId))
    .leftJoin(mandals, eq(mandals.id, members.mandalId))
    .where(where)
    .orderBy(desc(members.createdAt))
    .limit(PAGE)
    .offset((page - 1) * PAGE);
  const qs = (p: number) => new URLSearchParams({ ...(Object.fromEntries(Object.entries(sp).filter(([, v]) => v)) as Record<string, string>), page: String(p) }).toString();
  const exportQs = new URLSearchParams(Object.fromEntries(Object.entries(sp).filter(([k, v]) => v && k !== "page" && k !== "msg" && k !== "err")) as Record<string, string>).toString();
  return (
    <>
      <PageHeader
        title="Members Management"
        crumbs={[{ label: "Members" }, { label: "All Members" }]}
        actions={<>
          {can(ctx, "members", "create") && <Link href="/admin/members/new" className="btn btn-primary btn-sm">+ Add Member</Link>}
          {can(ctx, "members", "export") && <a href={`/api/reports/export?type=members&${exportQs}`} className="btn btn-outline btn-sm"><Download size={14} /> Export</a>}
        </>}
      />
      <Flash sp={sp} />
      <form className="card mb-4 grid gap-3 md:grid-cols-6">
        <div className="md:col-span-2"><label className="label" htmlFor="q">Search</label><input id="q" name="q" defaultValue={sp.q} placeholder="Name, mobile, membership no, workshop" className="input" /></div>
        <div><label className="label" htmlFor="status">Status</label><select id="status" name="status" defaultValue={sp.status ?? ""} className="input"><option value="">All</option>{["pending", "under_review", "active", "expired", "suspended", "rejected"].map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}</select></div>
        <GeoSelect districts={ds} mandals={ms} districtId={sp.districtId} mandalId={sp.mandalId} required={false} optional />
        <div><label className="label" htmlFor="renewal">Renewal</label><select id="renewal" name="renewal" defaultValue={sp.renewal ?? ""} className="input"><option value="">Any</option><option value="due">Due in 30 days</option></select></div>
        <div><label className="label" htmlFor="from">Registered from</label><input id="from" type="date" name="from" defaultValue={sp.from} className="input" /></div>
        <div><label className="label" htmlFor="to">to</label><input id="to" type="date" name="to" defaultValue={sp.to} className="input" /></div>
        <div className="flex items-end gap-2"><button className="btn btn-primary btn-sm">Filter</button><Link href="/admin/members" className="btn btn-outline btn-sm">Reset</Link></div>
      </form>
      {rows.length === 0 ? <EmptyState title="No members found" hint="Registered members appear here as soon as they apply." /> : (
        <div className="card overflow-x-auto !p-0">
          <table className="tbl">
            <thead><tr><th>Member ID</th><th>Name</th><th>Mobile</th><th>District</th><th>Mandal</th><th>Valid till</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {rows.map(({ m, d, md }) => (
                <tr key={m.id}>
                  <td className="whitespace-nowrap">{m.membershipNo ?? <span className="text-slate-400">{m.applicationRef}</span>}</td>
                  <td className="font-semibold">{m.fullName}<span className="block text-[11px] font-normal text-slate-500">{m.workshopName}</span></td>
                  <td>{m.mobile}</td><td>{d}</td><td>{md}</td><td>{formatDate(m.validTill)}</td>
                  <td><StatusBadge status={m.status} /></td>
                  <td><Link href={`/admin/members/${m.id}`} className="btn btn-outline btn-sm" aria-label="View"><Eye size={14} /></Link></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex items-center justify-between border-t p-3 text-xs text-slate-600">
            <span>{n} member(s) • page {page} of {Math.max(1, Math.ceil(n / PAGE))}</span>
            <span className="flex gap-2">{page > 1 && <Link className="btn btn-outline btn-sm" href={`/admin/members?${qs(page - 1)}`}>Previous</Link>}{page * PAGE < n && <Link className="btn btn-outline btn-sm" href={`/admin/members?${qs(page + 1)}`}>Next</Link>}</span>
          </div>
        </div>
      )}
    </>
  );
}
