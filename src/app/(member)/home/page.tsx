import Link from "next/link";
import { and, count, desc, eq, isNull } from "drizzle-orm";
import { AlertTriangle, CalendarDays, CreditCard, HeartHandshake, IdCard, Newspaper, RefreshCw, ShoppingBag, BadgeCheck, Package } from "lucide-react";
import { db } from "@/db";
import { notifications, orders, welfareApplications, welfareSchemes } from "@/db/schema";
import { Avatar, Flash, StatusBadge } from "@/components/shared/ui";
import { PayButton } from "@/components/shared/PayButton";
import { requireMember } from "@/lib/auth/session";
import { latestNews, upcomingEvents } from "@/lib/data/content";
import { getLang, t } from "@/lib/i18n";
import { applicationFee, renewalFee } from "@/lib/membership/membership";
import { razorpayConfigured } from "@/lib/payments/razorpay";
import { getSettings } from "@/lib/settings";
import { formatDate, formatDateTime, formatINR, label } from "@/lib/utils";

export const metadata = { title: "Home" };

export default async function HomePage({ searchParams }: { searchParams: Promise<{ msg?: string; err?: string }> }) {
  const sp = await searchParams;
  const { member: m, user } = await requireMember();
  const lang = await getLang();
  const s = await getSettings();
  const [newsList, eventList, [unread], [lastWelfare], [lastOrder], fee] = await Promise.all([
    latestNews(m, 3),
    upcomingEvents(m, 3),
    db.select({ n: count() }).from(notifications).where(and(eq(notifications.userId, user.id), isNull(notifications.readAt))),
    db
      .select({ w: welfareApplications, scheme: welfareSchemes.name })
      .from(welfareApplications)
      .innerJoin(welfareSchemes, eq(welfareSchemes.id, welfareApplications.schemeId))
      .where(eq(welfareApplications.memberId, m.id))
      .orderBy(desc(welfareApplications.createdAt))
      .limit(1),
    db.select().from(orders).where(eq(orders.userId, user.id)).orderBy(desc(orders.createdAt)).limit(1),
    applicationFee(m.id, m.planId),
  ]);

  const today = new Date().toISOString().slice(0, 10);
  const daysLeft = m.validTill ? Math.ceil((new Date(m.validTill + "T00:00:00").getTime() - new Date(today + "T00:00:00").getTime()) / 86400000) : null;
  const renewDue = m.membershipNo && daysLeft !== null && daysLeft <= 30;
  const renew = renewDue ? await renewalFee(m) : null;
  const canPayJoining = ["pending", "under_review"].includes(m.status) && !fee.paid && (s.paymentPolicy === "before_approval" || m.status === "under_review");

  const quick = [
    { href: "/member/membership/card", icon: IdCard, text: t(lang, "viewCard") },
    { href: "/member/membership/renewal", icon: RefreshCw, text: t(lang, "renew") },
    { href: "/member/payments", icon: CreditCard, text: t(lang, "payFees") },
    { href: "/welfare/apply", icon: HeartHandshake, text: t(lang, "applyWelfare") },
    { href: "/shop", icon: ShoppingBag, text: t(lang, "visitShop") },
    { href: "/news", icon: Newspaper, text: t(lang, "viewNotices") },
  ];

  return (
    <div className="space-y-4">
      <Flash sp={sp} />
      <section className="card flex items-center gap-3 !bg-navy text-white">
        <Avatar src={m.photoUrl} name={m.fullName} size={64} />
        <div className="min-w-0 flex-1">
          <p className="text-xs text-blue-200">{t(lang, "welcome")},</p>
          <h1 className="truncate text-lg font-bold">{m.fullName}</h1>
          <p className="text-xs text-blue-100">{t(lang, "membershipNo")}: <b>{m.membershipNo ?? "Awaiting approval"}</b></p>
          <p className="text-xs text-blue-100">{t(lang, "validTill")}: <b>{formatDate(m.validTill)}</b></p>
        </div>
        <StatusBadge status={m.status} />
      </section>

      {["pending", "under_review"].includes(m.status) && (
        <section className="card border-amber-200 bg-amber-50">
          <p className="flex items-center gap-2 text-sm font-bold text-amber-900"><AlertTriangle size={18} /> Application {m.applicationRef} — {label(m.status)}</p>
          <p className="mt-1 text-sm text-amber-900">
            {m.status === "pending" ? "Your application is waiting for review by the association." : "Your application has preliminary approval."}
            {!fee.paid && fee.amountPaise > 0 && ` Membership fee due: ${formatINR(fee.amountPaise)}.`}
          </p>
          {canPayJoining && (
            <div className="mt-2">
              {razorpayConfigured() ? (
                <PayButton kind="membership_fee" label={`Pay ${formatINR(fee.amountPaise)}`} />
              ) : (
                <p className="text-xs text-amber-800">Online payment is not configured yet. Pay your agent or the office; they will record it for verification.</p>
              )}
            </div>
          )}
          {m.status === "pending" && fee.amountPaise > 0 && s.paymentPolicy === "after_approval" && (
            <p className="mt-1 text-xs text-amber-800">You will be asked to pay after preliminary approval.</p>
          )}
        </section>
      )}
      {m.status === "rejected" && (
        <section className="card border-red-200 bg-red-50 text-sm text-red-800">Your application was rejected. Reason: {m.rejectReason ?? "Not specified"}. Contact the office for help.</section>
      )}
      {m.status === "suspended" && <section className="card border-red-200 bg-red-50 text-sm text-red-800">Your membership is suspended. Please contact the association office.</section>}
      {(m.status === "expired" || renewDue) && m.status !== "suspended" && (
        <section className="card border-amber-200 bg-amber-50">
          <p className="flex items-center gap-2 text-sm font-bold text-amber-900"><RefreshCw size={16} /> {m.status === "expired" ? "Membership expired" : `Renewal due in ${daysLeft} day(s)`}</p>
          <Link href="/member/membership/renewal" className="btn btn-accent btn-sm mt-2">Renew{renew && renew.amountPaise > 0 ? ` • ${formatINR(renew.amountPaise)}` : ""}</Link>
        </section>
      )}

      <section>
        <h2 className="mb-2 text-sm font-bold text-navy">{t(lang, "quickActions")}</h2>
        <div className="grid grid-cols-3 gap-2 md:grid-cols-6">
          {quick.map((q) => (
            <Link key={q.href} href={q.href} className="card flex flex-col items-center gap-1.5 !p-3 text-center hover:border-royal">
              <q.icon className="text-royal" size={22} />
              <span className="text-[11px] font-semibold leading-tight text-navy">{q.text}</span>
            </Link>
          ))}
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-3">
        <section className="card">
          <p className="mb-1 flex items-center gap-1 text-xs font-bold text-slate-500"><BadgeCheck size={14} /> Payment status</p>
          <p className="text-sm">{fee.paid ? "Joining fee paid / not due" : `Joining fee due: ${formatINR(fee.amountPaise)}`}</p>
        </section>
        <section className="card">
          <p className="mb-1 flex items-center gap-1 text-xs font-bold text-slate-500"><HeartHandshake size={14} /> Welfare application</p>
          {lastWelfare ? (
            <Link href={`/welfare/${lastWelfare.w.id}`} className="text-sm">{lastWelfare.scheme} <StatusBadge status={lastWelfare.w.status} /></Link>
          ) : (
            <p className="text-sm text-slate-500">No applications yet.</p>
          )}
        </section>
        <section className="card">
          <p className="mb-1 flex items-center gap-1 text-xs font-bold text-slate-500"><Package size={14} /> Latest shop order</p>
          {lastOrder ? (
            <Link href={`/shop/orders/${lastOrder.id}`} className="text-sm">{lastOrder.orderNo} <StatusBadge status={lastOrder.status} /></Link>
          ) : (
            <p className="text-sm text-slate-500">No orders yet.</p>
          )}
          <p className="mt-2 text-[11px] text-slate-500">Unread notifications: {unread.n}</p>
        </section>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <section>
          <div className="mb-2 flex items-center justify-between"><h2 className="text-sm font-bold text-navy">{t(lang, "latestNews")}</h2><Link href="/news" className="link text-xs">View all</Link></div>
          <div className="space-y-2">
            {newsList.length === 0 && <p className="card text-sm text-slate-500">No news published yet.</p>}
            {newsList.map((n) => (
              <Link key={n.id} href={`/news/${n.id}`} className="card block !p-3 hover:border-royal">
                <p className="text-sm font-semibold text-navy">{n.title}</p>
                <p className="text-[11px] text-slate-500">{label(n.category)} • {formatDate(n.publishAt)}</p>
              </Link>
            ))}
          </div>
        </section>
        <section>
          <div className="mb-2 flex items-center justify-between"><h2 className="text-sm font-bold text-navy">{t(lang, "upcomingEvents")}</h2><Link href="/events" className="link text-xs">View all</Link></div>
          <div className="space-y-2">
            {eventList.length === 0 && <p className="card text-sm text-slate-500">No upcoming events.</p>}
            {eventList.map((e) => (
              <Link key={e.id} href={`/events/${e.id}`} className="card flex items-center gap-3 !p-3 hover:border-royal">
                <CalendarDays className="text-royal" size={22} />
                <span>
                  <span className="block text-sm font-semibold text-navy">{e.title}</span>
                  <span className="block text-[11px] text-slate-500">{formatDateTime(e.startsAt)} • {e.venue ?? "Venue TBA"}</span>
                </span>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
