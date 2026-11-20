import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { eventRegistrations, events } from "@/db/schema";
import { Flash, PageHeader, StatusBadge } from "@/components/shared/ui";
import { SubmitButton } from "@/components/forms/controls";
import { registerEventAction } from "@/actions/member.actions";
import { requireMember } from "@/lib/auth/session";
import { visibleEvents } from "@/lib/data/content";
import { EVENT_CATEGORIES } from "@/constants/status";
import { formatDateTime } from "@/lib/utils";

export default async function EventDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ msg?: string; err?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const { member } = await requireMember();
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const [e] = await db.select().from(events).where(and(eq(events.id, id), visibleEvents(member)));
  if (!e) notFound();
  const [reg] = await db.select().from(eventRegistrations).where(and(eq(eventRegistrations.eventId, id), eq(eventRegistrations.memberId, member.id)));
  const past = e.startsAt < new Date();
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={e.title} crumbs={[{ label: "Events", href: "/events" }, { label: EVENT_CATEGORIES[e.category] ?? "Event" }]} />
      <Flash sp={sp} />
      <div className="card space-y-3">
        {e.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={e.imageUrl} alt="" className="max-h-72 w-full rounded-lg object-cover" />
        )}
        {e.status === "cancelled" && <StatusBadge status="cancelled" />}
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <div><dt className="text-xs font-semibold text-slate-500">Starts</dt><dd>{formatDateTime(e.startsAt)}</dd></div>
          <div><dt className="text-xs font-semibold text-slate-500">Ends</dt><dd>{e.endsAt ? formatDateTime(e.endsAt) : "—"}</dd></div>
          <div><dt className="text-xs font-semibold text-slate-500">Venue</dt><dd>{e.venue ?? "—"}</dd></div>
          <div><dt className="text-xs font-semibold text-slate-500">Organizer</dt><dd>{e.organizer ?? "—"}</dd></div>
          <div><dt className="text-xs font-semibold text-slate-500">Contact</dt><dd>{e.contact ?? "—"}</dd></div>
          <div><dt className="text-xs font-semibold text-slate-500">Attendance</dt><dd>{reg ? (reg.attended ? "Present" : past ? "Not recorded" : "Registered") : "Not registered"}</dd></div>
        </dl>
        {e.description && <p className="whitespace-pre-wrap text-sm">{e.description}</p>}
        {!past && e.status === "published" && e.registrationOpen && (
          <form action={registerEventAction}>
            <input type="hidden" name="eventId" value={e.id} />
            {reg ? (
              <>
                <input type="hidden" name="cancel" value="1" />
                <SubmitButton className="btn-outline" confirm="Cancel your registration?">Cancel registration</SubmitButton>
              </>
            ) : (
              <SubmitButton className="btn-primary">Register for this event</SubmitButton>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
