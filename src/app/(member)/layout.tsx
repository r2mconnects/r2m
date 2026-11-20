import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { and, count, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { cartItems, notifications } from "@/db/schema";
import { MemberShell } from "@/components/layout/MemberShell";
import { requireUser } from "@/lib/auth/session";
import { getLang, t } from "@/lib/i18n";
import { getSettings } from "@/lib/settings";
import { syncExpiry } from "@/lib/membership/membership";
import { DRAWER_LINKS, BOTTOM_NAV } from "@/constants/navigation";

export default async function MemberLayout({ children }: { children: ReactNode }) {
  const ctx = await requireUser();
  if (!ctx.member) redirect(ctx.isStaff ? "/admin/dashboard" : "/unauthorized");
  await syncExpiry();
  const lang = await getLang();
  const s = await getSettings();
  const [[u], [c]] = await Promise.all([
    db.select({ n: count() }).from(notifications).where(and(eq(notifications.userId, ctx.user.id), isNull(notifications.readAt))),
    db.select({ n: count() }).from(cartItems).where(eq(cartItems.userId, ctx.user.id)),
  ]);
  const labels: Record<string, string> = {};
  for (const k of [...DRAWER_LINKS, ...BOTTOM_NAV].map((x) => x.key).concat(["adminPanel", "more", "logout", "settings"])) labels[k] = t(lang, k);
  return (
    <MemberShell
      labels={labels}
      user={{ name: ctx.user.fullName, photoUrl: ctx.user.photoUrl, memberNo: ctx.member.membershipNo }}
      unread={u.n}
      cartCount={c.n}
      canAdmin={ctx.isStaff}
      assoc={s.associationName}
    >
      {children}
    </MemberShell>
  );
}
