import { and, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { members, notifications } from "@/db/schema";
import { syncExpiry } from "@/lib/membership/membership";
import { notify } from "@/lib/notifications/notify";
import { getSettings } from "@/lib/settings";

export async function runReminders() {
  await syncExpiry();
  const s = await getSettings();
  const days = s.reminderDays.split(",").map((d) => parseInt(d.trim(), 10)).filter((d) => d > 0);
  let sent = 0;
  const day = (offset: number) => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);
  for (const d of [...days, 0]) {
    const target = day(d);
    const rows = await db.select().from(members).where(and(eq(members.status, d === 0 ? "expired" : "active"), gte(members.validTill, d === 0 ? day(-1) : target), lte(members.validTill, d === 0 ? target : target)));
    for (const m of rows) {
      if (!m.userId) continue;
      const title = d === 0 ? "Your membership has expired" : `Your membership expires in ${d} day(s)`;
      const dup = await db.select({ id: notifications.id }).from(notifications).where(and(eq(notifications.userId, m.userId), eq(notifications.title, title), gte(notifications.createdAt, sql`now() - interval '2 days'`))).limit(1);
      if (dup.length) continue;
      await notify(m.userId, title, "Renew now to keep your benefits and ID card active.", "/member/membership/renewal", "reminder");
      sent++;
    }
  }
  return sent;
}
