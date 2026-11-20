import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { districts, emergencyContacts, emergencyRequests, members, users } from "@/db/schema";
import { saveEmergencyContactAction } from "@/actions/settings.actions";
import { updateEmergencyAction } from "@/actions/welfare.actions";
import { Field } from "@/components/forms/Field";
import { SubmitButton } from "@/components/forms/controls";
import { EmptyState, Flash, PageHeader, StatusBadge } from "@/components/shared/ui";
import { can, requirePermission } from "@/lib/auth/session";
import { getDistricts } from "@/lib/data/geo";
import { memberScope } from "@/lib/scope";
import { formatDateTime } from "@/lib/utils";
import { and } from "drizzle-orm";

export const metadata = { title: "Emergency" };

export default async function EmergencyAdmin({ searchParams }: { searchParams: Promise<{ msg?: string; err?: string }> }) {
  const sp = await searchParams;
  const ctx = await requirePermission("emergency", "view");
  const ds = await getDistricts();
  const reqs = await db
    .select({ r: emergencyRequests, m: members, coord: users.fullName })
    .from(emergencyRequests)
    .innerJoin(members, eq(members.id, emergencyRequests.memberId))
    .leftJoin(users, eq(users.id, emergencyRequests.assignedTo))
    .where(and(memberScope(ctx)))
    .orderBy(desc(emergencyRequests.createdAt))
    .limit(100);
  const contacts = await db.select({ c: emergencyContacts, d: districts.name }).from(emergencyContacts).leftJoin(districts, eq(districts.id, emergencyContacts.districtId));
  return (
    <>
      <PageHeader title="Emergency Management" subtitle="A submitted SOS is not a confirmed response until a coordinator acknowledges it." crumbs={[{ label: "Emergency" }]} />
      <Flash sp={sp} />
      <h2 className="mb-2 text-sm font-bold text-navy">SOS requests</h2>
      {reqs.length === 0 ? <EmptyState title="No SOS requests" /> : (
        <div className="mb-6 space-y-2">{reqs.map(({ r, m, coord }) => (
          <div key={r.id} id={r.id} className="card !p-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2"><b>{m.fullName} • <a className="link" href={`tel:${m.mobile}`}>{m.mobile}</a></b><StatusBadge status={r.status} /></div>
            <p className="text-xs text-slate-500">{formatDateTime(r.createdAt)} • Coordinator: {coord ?? "unassigned"}</p>
            <p className="mt-1">{r.message}</p>
            {r.lat && r.lng && <a className="link text-xs" target="_blank" href={`https://www.google.com/maps?q=${r.lat},${r.lng}`}>Shared location (member consented)</a>}
            {can(ctx, "emergency", "edit") && !["resolved", "closed"].includes(r.status) && (
              <form action={updateEmergencyAction} className="mt-2 flex flex-wrap items-center gap-2"><input type="hidden" name="id" value={r.id} /><input type="hidden" name="assignSelf" value="1" />
                <input name="note" placeholder="Response note" className="input max-w-64" defaultValue={r.responseNote ?? ""} />
                <button name="status" value="acknowledged" className="btn btn-outline btn-sm">Acknowledge</button><button name="status" value="responding" className="btn btn-outline btn-sm">Responding</button><button name="status" value="resolved" className="btn btn-success btn-sm">Resolved</button><button name="status" value="closed" className="btn btn-outline btn-sm">Close</button></form>
            )}
          </div>))}</div>
      )}
      <h2 className="mb-2 text-sm font-bold text-navy">Emergency contacts shown to members</h2>
      {can(ctx, "emergency", "manage") && (
        <form action={saveEmergencyContactAction} className="card mb-3 grid gap-3 sm:grid-cols-5"><Field label="Label" name="label" required placeholder="e.g. Ambulance — Hindupur" /><Field label="Phone" name="phone" required type="tel" />
          <Field label="Type" name="kind" options={[{ value: "association", label: "Association" }, { value: "ambulance", label: "Ambulance" }, { value: "hospital", label: "Hospital" }]} required /><Field label="District (blank = all)" name="districtId" options={ds.map((d) => ({ value: d.id, label: d.name }))} /><div className="flex items-end"><SubmitButton>Add</SubmitButton></div></form>
      )}
      {contacts.length === 0 ? <EmptyState title="No contacts configured" /> : <div className="card divide-y !p-0">{contacts.map(({ c, d }) => (
        <form key={c.id} action={saveEmergencyContactAction} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm"><input type="hidden" name="id" value={c.id} /><input type="hidden" name="delete" value="1" /><span><b>{c.label}</b> • {c.phone} • {c.kind} • {d ?? "All districts"}</span>{can(ctx, "emergency", "manage") && <SubmitButton className="btn-outline btn-sm" confirm="Remove this contact?">Remove</SubmitButton>}</form>))}</div>}
    </>
  );
}
