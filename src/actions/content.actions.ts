"use server";

import { and, eq, inArray, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import { eventRegistrations, events, members, news, supportTickets } from "@/db/schema";
import { requirePermission } from "@/lib/auth/session";
import { audit } from "@/lib/audit";
import { notify, notifyMany } from "@/lib/notifications/notify";
import { fileUrl, saveUpload } from "@/lib/uploads";
import { flash, str, strOrNull } from "@/lib/utils";

async function audienceUserIds(districtId: string | null, mandalId: string | null) {
  const conds = [eq(members.status, "active"), isNotNull(members.userId)];
  if (districtId) conds.push(eq(members.districtId, districtId));
  if (mandalId) conds.push(eq(members.mandalId, mandalId));
  const rows = await db.select({ u: members.userId }).from(members).where(and(...conds));
  return rows.map((r) => r.u!).filter(Boolean);
}

/** Staff limited to a district/mandal may only target their own area. */
function enforceAudience(ctx: Awaited<ReturnType<typeof requirePermission>>, districtId: string | null, mandalId: string | null, back: string) {
  if (ctx.scope.global) return;
  const ok = (districtId && ctx.scope.districtIds.includes(districtId)) || (mandalId && ctx.scope.mandalIds.includes(mandalId));
  if (!ok) flash(back, "err", "You can only publish to your own district or mandal.");
}

export async function saveNewsAction(fd: FormData) {
  const id = str(fd, "id");
  const ctx = await requirePermission("news", id ? "edit" : "create");
  const back = id ? `/admin/news?edit=${id}` : "/admin/news?new=1";
  const title = str(fd, "title");
  const body = str(fd, "body");
  if (!title || !body) flash(back, "err", "Title and content are required.");
  const districtId = strOrNull(fd, "districtId");
  const mandalId = strOrNull(fd, "mandalId");
  enforceAudience(ctx, districtId, mandalId, back);
  let image: string | null = null;
  let attach: string | null = null;
  try {
    image = await saveUpload(fd.get("image"), "image");
    attach = await saveUpload(fd.get("attachment"), "attachment");
  } catch (e) {
    flash(back, "err", (e as Error).message);
  }
  const when = strOrNull(fd, "publishAt");
  const status = ["draft", "published", "unpublished"].includes(str(fd, "status")) ? str(fd, "status") : "published";
  const vals = {
    title, body, summary: strOrNull(fd, "summary"), category: str(fd, "category") || "general", isNotice: fd.get("isNotice") === "on",
    status, publishAt: when ? new Date(when) : new Date(), districtId, mandalId,
    ...(image ? { imageUrl: fileUrl(image) } : {}), ...(attach ? { attachmentUrl: fileUrl(attach) } : {}),
  };
  let newsId = id;
  if (id) await db.update(news).set(vals).where(eq(news.id, id));
  else {
    const [n] = await db.insert(news).values({ ...vals, authorId: ctx.user.id }).returning();
    newsId = n.id;
  }
  if (!id && status === "published" && fd.get("notify") === "on" && vals.publishAt <= new Date()) {
    await notifyMany(await audienceUserIds(districtId, mandalId), title, vals.summary ?? undefined, `/news/${newsId}`, "news");
  }
  await audit(ctx.user.id, id ? "news.updated" : "news.created", "news", newsId);
  flash("/admin/news", "msg", "News saved.");
}

export async function newsStatusAction(fd: FormData) {
  const act = str(fd, "act"); // unpublish | publish | delete
  const ctx = await requirePermission("news", act === "delete" ? "delete" : "edit");
  const id = str(fd, "id");
  if (act === "delete") await db.delete(news).where(eq(news.id, id));
  else await db.update(news).set({ status: act === "publish" ? "published" : "unpublished" }).where(eq(news.id, id));
  await audit(ctx.user.id, `news.${act}`, "news", id);
  flash("/admin/news", "msg", "News updated.");
}

export async function saveEventAction(fd: FormData) {
  const id = str(fd, "id");
  const ctx = await requirePermission("events", id ? "edit" : "create");
  const back = id ? `/admin/events?edit=${id}` : "/admin/events?new=1";
  const title = str(fd, "title");
  const start = str(fd, "startsAt");
  if (!title || !start) flash(back, "err", "Title and start time are required.");
  const districtId = strOrNull(fd, "districtId");
  const mandalId = strOrNull(fd, "mandalId");
  enforceAudience(ctx, districtId, mandalId, back);
  let image: string | null = null;
  try {
    image = await saveUpload(fd.get("image"), "image");
  } catch (e) {
    flash(back, "err", (e as Error).message);
  }
  const end = strOrNull(fd, "endsAt");
  const vals = {
    title, description: strOrNull(fd, "description"), category: str(fd, "category") || "meeting", startsAt: new Date(start), endsAt: end ? new Date(end) : null,
    venue: strOrNull(fd, "venue"), organizer: strOrNull(fd, "organizer"), contact: strOrNull(fd, "contact"), districtId, mandalId,
    registrationOpen: fd.get("registrationOpen") === "on", ...(image ? { imageUrl: fileUrl(image) } : {}),
  };
  let eid = id;
  if (id) await db.update(events).set(vals).where(eq(events.id, id));
  else {
    const [e] = await db.insert(events).values({ ...vals, createdBy: ctx.user.id }).returning();
    eid = e.id;
    if (fd.get("notify") === "on") await notifyMany(await audienceUserIds(districtId, mandalId), `New event: ${title}`, vals.venue ?? undefined, `/events/${eid}`, "event");
  }
  await audit(ctx.user.id, id ? "event.updated" : "event.created", "event", eid);
  flash("/admin/events", "msg", "Event saved.");
}

export async function cancelEventAction(fd: FormData) {
  const ctx = await requirePermission("events", "edit");
  const id = str(fd, "id");
  const restore = str(fd, "restore") === "1";
  await db.update(events).set({ status: restore ? "published" : "cancelled" }).where(eq(events.id, id));
  if (!restore) {
    const regs = await db.select({ u: members.userId }).from(eventRegistrations).innerJoin(members, eq(members.id, eventRegistrations.memberId)).where(eq(eventRegistrations.eventId, id));
    await notifyMany(regs.map((r) => r.u!).filter(Boolean), "Event cancelled", undefined, `/events/${id}`, "event");
  }
  await audit(ctx.user.id, restore ? "event.restored" : "event.cancelled", "event", id);
  flash("/admin/events", "msg", restore ? "Event restored." : "Event cancelled and registrants notified.");
}

export async function attendanceAction(fd: FormData) {
  const ctx = await requirePermission("events", "edit");
  const eventId = str(fd, "eventId");
  const present = new Set(fd.getAll("present").map(String));
  const regs = await db.select().from(eventRegistrations).where(eq(eventRegistrations.eventId, eventId));
  for (const r of regs) await db.update(eventRegistrations).set({ attended: present.has(r.id) }).where(eq(eventRegistrations.id, r.id));
  await audit(ctx.user.id, "event.attendance", "event", eventId, { present: present.size });
  flash(`/admin/events?attendance=${eventId}`, "msg", "Attendance saved.");
}

export async function broadcastAction(fd: FormData) {
  const ctx = await requirePermission("notifications", "create");
  const back = "/admin/notifications";
  const title = str(fd, "title");
  if (!title) flash(back, "err", "Enter a title.");
  const districtId = strOrNull(fd, "districtId");
  const mandalId = strOrNull(fd, "mandalId");
  enforceAudience(ctx, districtId, mandalId, back);
  const ids = await audienceUserIds(districtId, mandalId);
  await notifyMany(ids, title, strOrNull(fd, "body") ?? undefined, strOrNull(fd, "link") ?? undefined, "announcement");
  await audit(ctx.user.id, "notification.broadcast", "notification", null, { recipients: ids.length, title });
  flash(back, "msg", `Sent to ${ids.length} member(s) in-app.`);
}

export async function replyTicketAction(fd: FormData) {
  const ctx = await requirePermission("support", "edit");
  const id = str(fd, "id");
  const reply = str(fd, "reply");
  if (!reply) flash("/admin/notifications?tab=support", "err", "Write a reply.");
  const [t] = await db.update(supportTickets).set({ reply, status: "answered", repliedBy: ctx.user.id }).where(eq(supportTickets.id, id)).returning();
  await notify(t.userId, `Reply to: ${t.subject}`, reply, "/member/support", "support");
  flash("/admin/notifications?tab=support", "msg", "Reply sent.");
}

void inArray;
