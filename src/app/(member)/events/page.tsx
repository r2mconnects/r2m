import Link from "next/link";
import { asc, desc, and, gte, lt } from "drizzle-orm";
import { CalendarDays, MapPin } from "lucide-react";
import { db } from "@/db";
import { events } from "@/db/schema";
import { EmptyState, PageHeader, StatusBadge, Tabs } from "@/components/shared/ui";
import { requireMember } from "@/lib/auth/session";
import { visibleEvents } from "@/lib/data/content";
import { EVENT_CATEGORIES } from "@/constants/status";
import { formatDateTime } from "@/lib/utils";

export const metadata = { title: "Events" };

export default async function EventsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab = "upcoming" } = await searchParams;
  const { member } = await requireMember();
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start.getTime() + 86400000);
  const where =
    tab === "today" ? and(visibleEvents(member), gte(events.startsAt, start), lt(events.startsAt, end))
    : tab === "past" ? and(visibleEvents(member), lt(events.startsAt, start))
    : and(visibleEvents(member), gte(events.startsAt, start));
  const list = await db.select().from(events).where(where).orderBy(tab === "past" ? desc(events.startsAt) : asc(events.startsAt)).limit(60);
  return (
    <>
      <PageHeader title="Events & Meetings" crumbs={[{ label: "Home", href: "/home" }, { label: "Events" }]} />
      <Tabs active={tab} base="/events" tabs={[{ key: "upcoming", label: "Upcoming" }, { key: "today", label: "Today" }, { key: "past", label: "Past" }]} />
      {list.length === 0 ? (
        <EmptyState title="No events" hint="Meetings, trainings and welfare camps will be listed here." />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {list.map((e) => (
            <Link key={e.id} href={`/events/${e.id}`} className="card hover:border-royal">
              <div className="mb-1 flex items-center justify-between">
                <span className="badge border-blue-200 bg-blue-100 text-blue-800">{EVENT_CATEGORIES[e.category] ?? e.category}</span>
              </div>
              <h2 className="font-bold text-navy">{e.title}</h2>
              <p className="mt-1 flex items-center gap-1 text-xs text-slate-600"><CalendarDays size={14} /> {formatDateTime(e.startsAt)}</p>
              <p className="flex items-center gap-1 text-xs text-slate-600"><MapPin size={14} /> {e.venue ?? "Venue to be announced"}</p>
            </Link>
          ))}
        </div>
      )}
      <span className="hidden"><StatusBadge status="active" /></span>
    </>
  );
}
