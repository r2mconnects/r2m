import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { bloodDonors, bloodRequests, districts, mandals, members } from "@/db/schema";
import { bloodRequestAction, saveDonorAction, withdrawDonorAction } from "@/actions/member.actions";
import { Checkbox, Field } from "@/components/forms/Field";
import { SubmitButton } from "@/components/forms/controls";
import { EmptyState, Flash, PageHeader, StatusBadge } from "@/components/shared/ui";
import { requireMember } from "@/lib/auth/session";
import { BLOOD_GROUPS } from "@/constants/status";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Blood donors" };

export default async function BloodPage({ searchParams }: { searchParams: Promise<{ msg?: string; err?: string; group?: string }> }) {
  const sp = await searchParams;
  const { member } = await requireMember();
  const [mine] = await db.select().from(bloodDonors).where(eq(bloodDonors.memberId, member.id));
  const conds = [eq(bloodDonors.available, true), eq(bloodDonors.consent, true)];
  if (sp.group) conds.push(eq(bloodDonors.bloodGroup, sp.group));
  const donors = await db
    .select({ d: bloodDonors, name: members.fullName, district: districts.name, mandal: mandals.name })
    .from(bloodDonors)
    .innerJoin(members, eq(members.id, bloodDonors.memberId))
    .leftJoin(districts, eq(districts.id, bloodDonors.districtId))
    .leftJoin(mandals, eq(mandals.id, bloodDonors.mandalId))
    .where(and(...conds));
  const reqs = await db.select().from(bloodRequests).where(eq(bloodRequests.status, "open")).orderBy(desc(bloodRequests.createdAt)).limit(10);
  const grp = BLOOD_GROUPS.map((g) => ({ value: g, label: g }));
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Blood Donor Network" crumbs={[{ label: "Member", href: "/member" }, { label: "Blood Donors" }]} />
      <Flash sp={sp} />
      <div className="grid gap-4 md:grid-cols-2">
        <form action={saveDonorAction} className="card space-y-2">
          <h2 className="text-sm font-bold text-navy">{mine ? "My donor profile" : "Become a donor"}</h2>
          <Field label="Blood group" name="bloodGroup" required options={grp} defaultValue={mine?.bloodGroup} />
          <Field label="Approximate location (area / town)" name="location" defaultValue={mine?.location} />
          <Checkbox name="available" label="I am currently available to donate" defaultChecked={mine?.available ?? true} />
          <Checkbox name="consent" label="I consent to being listed. My phone number is never shown; requesters contact via the association." defaultChecked={mine?.consent} />
          <div className="flex gap-2"><SubmitButton>Save</SubmitButton></div>
        </form>
        <form action={bloodRequestAction} className="card space-y-2">
          <h2 className="text-sm font-bold text-navy">Request blood</h2>
          <div className="grid grid-cols-2 gap-2"><Field label="Blood group" name="bloodGroup" required options={grp} /><Field label="Units" name="units" type="number" min={1} defaultValue={1} /></div>
          <Field label="Hospital" name="hospital" required />
          <Field label="Contact phone" name="contactPhone" type="tel" required />
          <Field label="Note" name="note" />
          <SubmitButton className="btn-danger">Post request</SubmitButton>
        </form>
      </div>
      {mine && <form action={withdrawDonorAction} className="mt-2"><SubmitButton className="btn-outline btn-sm" confirm="Withdraw from the donor network?">Withdraw from network</SubmitButton></form>}

      <h2 className="mb-2 mt-5 text-sm font-bold text-navy">Open requests</h2>
      {reqs.length === 0 ? <EmptyState title="No open blood requests" /> : (
        <div className="grid gap-2 sm:grid-cols-2">{reqs.map((r) => <div key={r.id} className="card !p-3 text-sm"><b className="text-red-600">{r.bloodGroup}</b> • {r.units} unit(s) • {r.hospital}<br /><span className="text-xs text-slate-500">{formatDate(r.createdAt)} • <a className="link" href={`tel:${r.contactPhone}`}>{r.contactPhone}</a></span></div>)}</div>
      )}

      <h2 className="mb-2 mt-5 text-sm font-bold text-navy">Available donors</h2>
      <form className="mb-2 flex gap-2"><select name="group" defaultValue={sp.group ?? ""} className="input max-w-40"><option value="">All groups</option>{BLOOD_GROUPS.map((g) => <option key={g}>{g}</option>)}</select><button className="btn btn-outline btn-sm">Filter</button></form>
      {donors.length === 0 ? <EmptyState title="No donors found" /> : (
        <div className="card overflow-x-auto !p-0">
          <table className="tbl"><thead><tr><th>Name</th><th>Group</th><th>District</th><th>Mandal</th><th>Area</th><th></th></tr></thead>
            <tbody>{donors.map((x) => <tr key={x.d.id}><td>{x.name}</td><td><StatusBadge status="open" text={x.d.bloodGroup} /></td><td>{x.district}</td><td>{x.mandal}</td><td>{x.d.location ?? "—"}</td><td className="text-xs text-slate-500">Contact via association</td></tr>)}</tbody></table>
        </div>
      )}
    </div>
  );
}
