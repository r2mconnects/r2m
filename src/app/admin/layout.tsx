import type { ReactNode } from "react";
import { and, count, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/db";
import { members, notifications } from "@/db/schema";
import { AdminShell } from "@/components/layout/AdminShell";
import { can, requireStaff } from "@/lib/auth/session";
import { memberScope } from "@/lib/scope";
import { getSettings } from "@/lib/settings";
import { ADMIN_NAV } from "@/constants/navigation";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const ctx = await requireStaff();
  const s = await getSettings();
  const showApps = can(ctx, "applications", "view");
  const [[u], [a]] = await Promise.all([
    db.select({ n: count() }).from(notifications).where(and(eq(notifications.userId, ctx.user.id), isNull(notifications.readAt))),
    showApps
      ? db.select({ n: count() }).from(members).where(and(inArray(members.status, ["pending", "under_review"]), memberScope(ctx)))
      : Promise.resolve([{ n: 0 }]),
  ]);
  const nav = ADMIN_NAV.filter((n) => n.module === "*" || can(ctx, n.module, "view")).map((n) => ({
    label: n.label, href: n.href, icon: n.icon, badge: n.badge === "applications" ? a.n : undefined,
  }));
  const roleLabel = ctx.roles.filter((r) => r.roleKey !== "member").map((r) => r.roleName).join(", ");
  return (
    <AdminShell nav={nav} user={{ name: ctx.user.fullName, photoUrl: ctx.user.photoUrl }} roleLabel={roleLabel} unread={u.n} assoc={s.associationName} hasMemberArea={Boolean(ctx.member)} canSearch={can(ctx, "members", "view")}>
      {children}
    </AdminShell>
  );
}
