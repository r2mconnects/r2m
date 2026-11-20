import { and, desc, eq, isNull, lte, or, asc, gte, type SQL } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { events, news } from "@/db/schema";

type Aud = { districtId: string | null; mandalId: string | null };

function audience(cols: { districtId: PgColumn; mandalId: PgColumn }, m: Aud): SQL | undefined {
  return and(
    m.districtId ? or(isNull(cols.districtId), eq(cols.districtId, m.districtId)) : isNull(cols.districtId),
    m.mandalId ? or(isNull(cols.mandalId), eq(cols.mandalId, m.mandalId)) : isNull(cols.mandalId),
  );
}

export function visibleNews(m: Aud, extra?: SQL) {
  return and(eq(news.status, "published"), lte(news.publishAt, new Date()), audience(news, m), extra);
}

export async function latestNews(m: Aud, limit = 20, category?: string) {
  return db
    .select()
    .from(news)
    .where(visibleNews(m, category ? eq(news.category, category) : undefined))
    .orderBy(desc(news.publishAt))
    .limit(limit);
}

export async function upcomingEvents(m: Aud, limit = 20) {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  return db
    .select()
    .from(events)
    .where(and(eq(events.status, "published"), gte(events.startsAt, startOfToday), audience(events, m)))
    .orderBy(asc(events.startsAt))
    .limit(limit);
}

export function visibleEvents(m: Aud) {
  return and(eq(events.status, "published"), audience(events, m));
}
