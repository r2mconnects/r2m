import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq, gt } from "drizzle-orm";
import { db } from "@/db";
import { members, roles, sessions, userRoles, users, type Permissions } from "@/db/schema";
import { randomToken, sha256 } from "@/lib/utils";
import type { Action } from "@/constants/roles";

export const SESSION_COOKIE = "r2m_session";

export type AssignedRole = {
  roleKey: string;
  roleName: string;
  scope: string;
  level: number;
  districtId: string | null;
  mandalId: string | null;
  permissions: Permissions;
};

export type AuthCtx = {
  user: { id: string; fullName: string; email: string | null; mobile: string | null; photoUrl: string | null; language: string };
  roles: AssignedRole[];
  permissions: Permissions;
  isMainAdmin: boolean;
  isStaff: boolean;
  minLevel: number;
  scope: { global: boolean; districtIds: string[]; mandalIds: string[]; agent: boolean };
  member: typeof members.$inferSelect | null;
};

export async function createSession(userId: string, remember: boolean) {
  const token = randomToken(32);
  const maxAge = remember ? 60 * 60 * 24 * 30 : 60 * 60 * 24;
  await db.insert(sessions).values({ id: sha256(token), userId, expiresAt: new Date(Date.now() + maxAge * 1000) });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" && process.env.INSECURE_COOKIES !== "1",
    path: "/",
    maxAge,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await db.delete(sessions).where(eq(sessions.id, sha256(token)));
  jar.delete(SESSION_COOKIE);
}

export const getAuth = cache(async (): Promise<AuthCtx | null> => {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const [row] = await db
    .select({ user: users })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.id, sha256(token)), gt(sessions.expiresAt, new Date())))
    .limit(1);
  if (!row || row.user.status !== "active") return null;
  const u = row.user;

  const assigned = await db
    .select({
      roleKey: roles.key,
      roleName: roles.name,
      scope: roles.scope,
      level: roles.level,
      permissions: roles.permissions,
      districtId: userRoles.districtId,
      mandalId: userRoles.mandalId,
    })
    .from(userRoles)
    .innerJoin(roles, eq(roles.key, userRoles.roleKey))
    .where(and(eq(userRoles.userId, u.id), eq(userRoles.active, true)));

  const [member] = await db.select().from(members).where(eq(members.userId, u.id)).limit(1);

  const merged: Permissions = {};
  const scope: AuthCtx["scope"] = { global: false, districtIds: [], mandalIds: [], agent: false };
  let isMainAdmin = false;
  for (const r of assigned) {
    if (r.roleKey === "main_admin") isMainAdmin = true;
    for (const [m, acts] of Object.entries(r.permissions ?? {})) {
      merged[m] = Array.from(new Set([...(merged[m] ?? []), ...acts]));
    }
    if (r.roleKey === "member") continue;
    if (r.scope === "global") scope.global = true;
    if (r.scope === "district" && r.districtId) scope.districtIds.push(r.districtId);
    if ((r.scope === "mandal" || r.scope === "agent") && r.mandalId) scope.mandalIds.push(r.mandalId);
    if (r.scope === "agent") scope.agent = true;
  }
  const staffRoles = assigned.filter((r) => r.roleKey !== "member");
  return {
    user: { id: u.id, fullName: u.fullName, email: u.email, mobile: u.mobile, photoUrl: u.photoUrl, language: u.language },
    roles: assigned.map((r) => ({ ...r, permissions: r.permissions ?? {} })),
    permissions: merged,
    isMainAdmin,
    isStaff: staffRoles.length > 0,
    minLevel: staffRoles.length ? Math.min(...staffRoles.map((r) => r.level)) : 99,
    scope: { ...scope, global: scope.global || isMainAdmin },
    member: member ?? null,
  };
});

export function can(ctx: AuthCtx | null, module: string, action: Action | string = "view") {
  if (!ctx) return false;
  if (ctx.isMainAdmin) return true;
  const acts = ctx.permissions[module] ?? [];
  return acts.includes(action) || acts.includes("manage");
}

export async function requireUser(): Promise<AuthCtx> {
  const ctx = await getAuth();
  if (!ctx) redirect("/login");
  return ctx;
}

export async function requireMember(): Promise<AuthCtx & { member: NonNullable<AuthCtx["member"]> }> {
  const ctx = await requireUser();
  if (!ctx.member) redirect(ctx.isStaff ? "/admin/dashboard" : "/unauthorized");
  return ctx as AuthCtx & { member: NonNullable<AuthCtx["member"]> };
}

/** Server-side authorization for staff pages and actions. */
export async function requirePermission(module: string, action: Action | string = "view"): Promise<AuthCtx> {
  const ctx = await requireUser();
  if (!can(ctx, module, action)) redirect("/unauthorized");
  return ctx;
}

export async function requireStaff(): Promise<AuthCtx> {
  const ctx = await requireUser();
  if (!ctx.isStaff) redirect("/unauthorized");
  return ctx;
}

export function homeFor(ctx: AuthCtx) {
  if (ctx.isStaff && !ctx.member) return "/admin/dashboard";
  if (ctx.isStaff && ctx.isMainAdmin) return "/admin/dashboard";
  return ctx.member ? "/home" : ctx.isStaff ? "/admin/dashboard" : "/unauthorized";
}
