import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { notifications, supportTickets, users } from "@/db/schema";
import { broadcastAction, replyTicketAction } from "@/actions/content.actions";
import { runRemindersAction } from "@/actions/settings.actions";
import { Field } from "@/components/forms/Field";
import { GeoSelect, SubmitButton } from "@/components/forms/controls";
import { EmptyState, Flash, PageHeader, StatusBadge, Tabs } from "@/components/shared/ui";
import { can, requireStaff } from "@/lib/auth/session";
import { getDistricts, getMandals } from "@/lib/data/geo";
import { channelStatus } from "@/lib/notifications/notify";
import { formatDateTime } from "@/lib/utils";

export const metadata = { title: "Notifications" };

export default async function NotificationsAdmin({ searchParams }: { searchParams: Promise<{ tab?: string; msg?: string; err?: string }> }) {
  const sp = await searchParams;
  const ctx = await requireStaff();
  const tab = sp.tab ?? "mine";
  const [ds, ms] = await Promise.all([getDistricts(), getMandals()]);
  const ch = channelStatus();
  const mine = await db.select().from(notifications).where(eq(notifications.userId, ctx.user.id)).orderBy(desc(notifications.createdAt)).limit(50);
  const sent = can(ctx, "notifications", "view") ? await db.select().from(notifications).orderBy(desc(notifications.createdAt)).limit(50) : [];
  const tickets = can(ctx, "support", "view") ? await db.select({ t: supportTickets, who: users.fullName }).from(supportTickets).innerJoin(users, eq(users.id, supportTickets.userId)).orderBy(desc(supportTickets.createdAt)).limit(50) : [];
  const aD = ctx.scope.global ? ds : ds.filter((d) => ctx.scope.districtIds.includes(d.id));
  const aM = ctx.scope.global ? ms : ms.filter((m) => ctx.scope.districtIds.includes(m.districtId) || ctx.scope.mandalIds.includes(m.id));
  return (
    <>
      <PageHeader title="Notifications" crumbs={[{ label: "Notifications" }]} />
      <Flash sp={sp} />
      <Tabs active={tab} base="/admin/notifications" tabs={[{ key: "mine", label: "My notifications" }, ...(can(ctx, "notifications", "create") ? [{ key: "broadcast", label: "Broadcast" }] : []), ...(can(ctx, "notifications", "view") ? [{ key: "log", label: "Delivery log" }] : []), ...(can(ctx, "support", "view") ? [{ key: "support", label: `Support (${tickets.filter((t) => t.t.status === "open").length} open)` }] : [])]} />
      {tab === "mine" && (mine.length === 0 ? <EmptyState title="No notifications" /> : <div className="space-y-2">{mine.map((n) => <div key={n.id} className="card !p-3"><p className="text-sm font-semibold text-navy">{n.title}</p>{n.body && <p className="text-sm text-slate-600">{n.body}</p>}<p className="text-[11px] text-slate-400">{formatDateTime(n.createdAt)}</p></div>)}</div>)}
      {tab === "broadcast" && (
        <div className="grid gap-4 md:grid-cols-2">
          <form action={broadcastAction} className="card space-y-3"><h2 className="text-sm font-bold text-navy">Send announcement to active members</h2>
            <Field label="Title" name="title" required /><Field label="Message" name="body" rows={3} /><Field label="Link (optional, e.g. /news)" name="link" />
            <div className="grid grid-cols-2 gap-3"><GeoSelect districts={aD} mandals={aM} required={false} optional /></div>
            <SubmitButton confirm="Send this notification now?">Send</SubmitButton></form>
          <div className="space-y-3">
            <section className="card text-sm"><h2 className="mb-2 font-bold text-navy">Channels</h2>
              {([["In-app", ch.in_app], ["Email", ch.email], ["SMS", ch.sms], ["WhatsApp", ch.whatsapp]] as const).map(([n, ok]) => <p key={n} className="flex justify-between">{n}<StatusBadge status={ok ? "active" : "pending"} text={ok ? "Configured" : "Not configured"} /></p>)}
              <p className="mt-2 text-xs text-slate-500">External channels activate when EMAIL_PROVIDER_API_KEY, SMS_PROVIDER_API_KEY or WHATSAPP_PROVIDER_TOKEN is set. Until then deliveries are logged as “not configured”, never as sent.</p></section>
            {can(ctx, "notifications", "manage") && <form action={runRemindersAction} className="card"><p className="mb-2 text-sm">Mark expired memberships and send renewal reminders (also available as a scheduled job at <code>/api/notifications/cron</code>).</p><SubmitButton>Run expiry sync & reminders</SubmitButton></form>}
          </div>
        </div>
      )}
      {tab === "log" && (
        <div className="card overflow-x-auto !p-0"><table className="tbl"><thead><tr><th>When</th><th>Title</th><th>Kind</th><th>In-app</th><th>Email</th><th>SMS</th><th>WhatsApp</th></tr></thead>
          <tbody>{sent.map((n) => <tr key={n.id}><td>{formatDateTime(n.createdAt)}</td><td>{n.title}</td><td>{n.kind}</td>{["in_app", "email", "sms", "whatsapp"].map((c) => <td key={c} className="text-xs">{(n.channelStatus[c] ?? "—").replace("_", " ")}</td>)}</tr>)}</tbody></table></div>
      )}
      {tab === "support" && (tickets.length === 0 ? <EmptyState title="No support requests" /> : <div className="space-y-2">{tickets.map(({ t, who }) => (
        <div key={t.id} className="card !p-3 text-sm"><div className="flex justify-between"><b>{t.subject}</b><StatusBadge status={t.status} /></div><p className="text-xs text-slate-500">{who} • {formatDateTime(t.createdAt)}</p><p className="mt-1">{t.message}</p>
          {t.reply ? <p className="mt-2 rounded-lg bg-blue-50 p-2"><b>Reply:</b> {t.reply}</p> : can(ctx, "support", "edit") && <form action={replyTicketAction} className="mt-2 flex gap-2"><input type="hidden" name="id" value={t.id} /><input name="reply" required className="input" placeholder="Write a reply" /><SubmitButton>Reply</SubmitButton></form>}</div>))}</div>)}
    </>
  );
}
