import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { eventRegistrations, events, members } from "@/db/schema";
import { attendanceAction, cancelEventAction, saveEventAction } from "@/actions/content.actions";
import { Checkbox, Field } from "@/components/forms/Field";
import { GeoSelect, SubmitButton } from "@/components/forms/controls";
import { EmptyState, Flash, PageHeader, StatusBadge } from "@/components/shared/ui";
import { EVENT_CATEGORIES } from "@/constants/status";
import { can, requirePermission } from "@/lib/auth/session";
import { getDistricts, getMandals } from "@/lib/data/geo";
import { formatDateTime } from "@/lib/utils";

export const metadata = { title: "Events" };
const dt = (d: Date | null | undefined) => (d ? new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "");

export default async function EventsAdmin({ searchParams }: { searchParams: Promise<{ new?: string; edit?: string; attendance?: string; msg?: string; err?: string }> }) {
  const sp = await searchParams;
  const ctx = await requirePermission("events", "view");
  const list = await db.select().from(events).orderBy(desc(events.startsAt)).limit(100);
  const [ds, ms] = await Promise.all([getDistricts(), getMandals()]);
  const editing = sp.edit ? list.find((e) => e.id === sp.edit) : undefined;
  const showForm = (sp.new && can(ctx, "events", "create")) || (editing && can(ctx, "events", "edit"));
  const aD = ctx.scope.global ? ds : ds.filter((d) => ctx.scope.districtIds.includes(d.id));
  const aM = ctx.scope.global ? ms : ms.filter((m) => ctx.scope.districtIds.includes(m.districtId) || ctx.scope.mandalIds.includes(m.id));
  const att = sp.attendance ? list.find((e) => e.id === sp.attendance) : undefined;
  const regs = att ? await db.select({ r: eventRegistrations, name: members.fullName, no: members.membershipNo }).from(eventRegistrations).innerJoin(members, eq(members.id, eventRegistrations.memberId)).where(eq(eventRegistrations.eventId, att.id)) : [];
  return (
    <>
      <PageHeader title="Events & Meetings" crumbs={[{ label: "Events" }]} actions={can(ctx, "events", "create") ? <Link href="/admin/events?new=1" className="btn btn-primary btn-sm">+ Create event</Link> : undefined} />
      <Flash sp={sp} />
      {showForm && (
        <form action={saveEventAction} className="card mb-4 grid gap-3 sm:grid-cols-2">
          {editing && <input type="hidden" name="id" value={editing.id} />}
          <h2 className="text-sm font-bold text-navy sm:col-span-2">{editing ? "Edit event" : "New event"}</h2>
          <Field label="Title" name="title" required defaultValue={editing?.title} className="sm:col-span-2" />
          <Field label="Description" name="description" rows={3} defaultValue={editing?.description} className="sm:col-span-2" />
          <Field label="Type" name="category" required defaultValue={editing?.category ?? "meeting"} options={Object.entries(EVENT_CATEGORIES).map(([value, label]) => ({ value, label }))} />
          <Field label="Venue" name="venue" defaultValue={editing?.venue} />
          <Field label="Starts" name="startsAt" type="datetime-local" required defaultValue={dt(editing?.startsAt)} />
          <Field label="Ends" name="endsAt" type="datetime-local" defaultValue={dt(editing?.endsAt)} />
          <GeoSelect districts={aD} mandals={aM} districtId={editing?.districtId} mandalId={editing?.mandalId} required={false} optional />
          <Field label="Organizer" name="organizer" defaultValue={editing?.organizer} />
          <Field label="Contact" name="contact" defaultValue={editing?.contact} />
          <Field label="Event image" name="image" type="file" accept="image/*" />
          <Checkbox name="registrationOpen" label="Registration open" defaultChecked={editing?.registrationOpen ?? true} />
          {!editing && <Checkbox name="notify" label="Notify the audience in-app" defaultChecked />}
          <div className="sm:col-span-2"><SubmitButton>Save event</SubmitButton></div>
        </form>
      )}
      {att && (
        <form action={attendanceAction} className="card mb-4"><input type="hidden" name="eventId" value={att.id} />
          <h2 className="mb-2 text-sm font-bold text-navy">Attendance — {att.title} ({regs.length} registered)</h2>
          {regs.length === 0 ? <p className="text-sm text-slate-500">No registrations.</p> : <div className="grid gap-1 sm:grid-cols-2">{regs.map(({ r, name, no }) => <label key={r.id} className="flex items-center gap-2 text-sm"><input type="checkbox" name="present" value={r.id} defaultChecked={r.attended} /> {name} <span className="text-xs text-slate-400">{no}</span></label>)}</div>}
          <div className="mt-3 flex gap-2"><SubmitButton>Save attendance</SubmitButton>{can(ctx, "events", "export") && <a href={`/api/reports/export?type=attendance&eventId=${att.id}`} className="btn btn-outline">Export CSV</a>}</div>
        </form>
      )}
      {list.length === 0 ? <EmptyState title="No events yet" /> : (
        <div className="card overflow-x-auto !p-0"><table className="tbl"><thead><tr><th>Event</th><th>Type</th><th>When</th><th>Venue</th><th>Status</th><th></th></tr></thead>
          <tbody>{list.map((e) => (
            <tr key={e.id}><td className="font-semibold">{e.title}</td><td>{EVENT_CATEGORIES[e.category]}</td><td>{formatDateTime(e.startsAt)}</td><td>{e.venue}</td><td><StatusBadge status={e.status} /></td>
              <td className="flex gap-1"><Link className="btn btn-outline btn-sm" href={`/admin/events?attendance=${e.id}`}>Attendance</Link>
                {can(ctx, "events", "edit") && <><Link className="btn btn-outline btn-sm" href={`/admin/events?edit=${e.id}`}>Edit</Link>
                  <form action={cancelEventAction}><input type="hidden" name="id" value={e.id} />{e.status === "cancelled" ? <><input type="hidden" name="restore" value="1" /><SubmitButton className="btn-outline btn-sm">Restore</SubmitButton></> : <SubmitButton className="btn-danger btn-sm" confirm="Cancel this event and notify registrants?">Cancel</SubmitButton>}</form></>}
              </td></tr>))}</tbody></table></div>
      )}
    </>
  );
}
