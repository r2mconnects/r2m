import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { markAllReadAction } from "@/actions/member.actions";
import { SubmitButton } from "@/components/forms/controls";
import { EmptyState, Flash, PageHeader } from "@/components/shared/ui";
import { requireUser } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/utils";

export const metadata = { title: "Notifications" };

export default async function NotificationsPage({ searchParams }: { searchParams: Promise<{ msg?: string; err?: string }> }) {
  const sp = await searchParams;
  const ctx = await requireUser();
  const list = await db.select().from(notifications).where(eq(notifications.userId, ctx.user.id)).orderBy(desc(notifications.createdAt)).limit(100);
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Notifications" crumbs={[{ label: "Home", href: "/home" }, { label: "Notifications" }]} actions={list.some((n) => !n.readAt) ? <form action={markAllReadAction}><SubmitButton className="btn-outline btn-sm">Mark all read</SubmitButton></form> : undefined} />
      <Flash sp={sp} />
      {list.length === 0 ? <EmptyState title="You're all caught up" /> : (
        <div className="space-y-2">
          {list.map((n) => {
            const inner = (
              <div className={`card !p-3 ${n.readAt ? "" : "border-l-4 border-l-royal"}`}>
                <p className="text-sm font-semibold text-navy">{n.title}</p>
                {n.body && <p className="text-sm text-slate-600">{n.body}</p>}
                <p className="mt-1 text-[11px] text-slate-400">{formatDateTime(n.createdAt)}</p>
              </div>
            );
            return n.link ? <Link key={n.id} href={n.link}>{inner}</Link> : <div key={n.id}>{inner}</div>;
          })}
        </div>
      )}
    </div>
  );
}
