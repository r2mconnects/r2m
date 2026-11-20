import { and, asc, eq, ilike, or } from "drizzle-orm";
import { MapPin, Phone, Wrench } from "lucide-react";
import { db } from "@/db";
import { districts, mandals, members } from "@/db/schema";
import { EmptyState, PageHeader } from "@/components/shared/ui";
import { GeoSelect } from "@/components/forms/controls";
import { requireMember } from "@/lib/auth/session";
import { getDistricts, getMandals } from "@/lib/data/geo";

export const metadata = { title: "Find mechanics" };

export default async function MechanicsPage({ searchParams }: { searchParams: Promise<{ q?: string; districtId?: string; mandalId?: string }> }) {
  const sp = await searchParams;
  await requireMember();
  const [ds, ms] = await Promise.all([getDistricts(), getMandals()]);
  const conds = [eq(members.status, "active"), eq(members.directoryOptIn, true), eq(members.directoryVerified, true)];
  if (sp.districtId) conds.push(eq(members.districtId, sp.districtId));
  if (sp.mandalId) conds.push(eq(members.mandalId, sp.mandalId));
  if (sp.q) {
    const q = `%${sp.q}%`;
    conds.push(or(ilike(members.fullName, q), ilike(members.workshopName, q), ilike(members.village, q), ilike(members.services, q), ilike(members.specialization, q))!);
  }
  const rows = await db
    .select({ m: members, district: districts.name, mandal: mandals.name })
    .from(members)
    .leftJoin(districts, eq(districts.id, members.districtId))
    .leftJoin(mandals, eq(mandals.id, members.mandalId))
    .where(and(...conds))
    .orderBy(asc(members.workshopName))
    .limit(100);
  return (
    <>
      <PageHeader title="Find a Mechanic" subtitle="Verified, opted-in workshops of association members" crumbs={[{ label: "Member", href: "/member" }, { label: "Mechanics" }]} />
      <form className="card mb-4 grid gap-3 sm:grid-cols-4">
        <div className="sm:col-span-4"><label className="label" htmlFor="q">Name, workshop, village or service</label><input id="q" name="q" defaultValue={sp.q} className="input" /></div>
        <GeoSelect districts={ds} mandals={ms} districtId={sp.districtId} mandalId={sp.mandalId} required={false} optional />
        <div className="flex items-end"><button className="btn btn-primary w-full">Search</button></div>
      </form>
      {rows.length === 0 ? <EmptyState title="No verified workshops found" hint="Only members who opted in and were verified by the association appear here." /> : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {rows.map(({ m, district, mandal }) => (
            <div key={m.id} className="card">
              <p className="flex items-center gap-2 font-bold text-navy"><Wrench size={16} className="text-royal" /> {m.workshopName}</p>
              <p className="text-sm">{m.fullName}</p>
              <p className="mt-1 flex items-center gap-1 text-xs text-slate-600"><MapPin size={13} /> {[m.workshopAddress, m.village, mandal, district].filter(Boolean).join(", ")}</p>
              {m.services && <p className="mt-1 text-xs"><b>Services:</b> {m.services}</p>}
              {m.workingHours && <p className="text-xs"><b>Hours:</b> {m.workingHours}</p>}
              <a href={`tel:${m.mobile}`} className="btn btn-outline btn-sm mt-2"><Phone size={13} /> Call</a>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
