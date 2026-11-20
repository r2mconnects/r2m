"use server";

import { and, eq, or } from "drizzle-orm";
import { db } from "@/db";
import { mandals, passwordResets, roles, sessions, userRoles, users } from "@/db/schema";
import { hashPassword } from "@/lib/auth/password";
import { requirePermission, type AuthCtx } from "@/lib/auth/session";
import { audit } from "@/lib/audit";
import { notify } from "@/lib/notifications/notify";
import { fileUrl, saveUpload } from "@/lib/uploads";
import { flash, randomToken, sha256, str, strOrNull } from "@/lib/utils";

async function checkAssignment(ctx: AuthCtx, roleKey: string, districtId: string | null, mandalId: string | null, back: string) {
  const [role] = await db.select().from(roles).where(eq(roles.key, roleKey));
  if (!role || role.key === "member") flash(back, "err", "Choose a valid staff role.");
  if (!ctx.isMainAdmin) {
    if (role.key === "main_admin") flash(back, "err", "Only the Main Admin can create administrators.");
    if (role.level <= ctx.minLevel) flash(back, "err", "You can only assign roles below your own level.");
  }
  if (role.scope === "district" && !districtId) flash(back, "err", "Select the district for this role.");
  if (role.scope === "mandal" && !mandalId) flash(back, "err", "Select the mandal for this role.");
  let effDistrict = districtId;
  if (mandalId) {
    const [m] = await db.select().from(mandals).where(eq(mandals.id, mandalId));
    if (!m) flash(back, "err", "Mandal not found.");
    effDistrict = m.districtId;
  }
  if (!ctx.scope.global) {
    const ok = (effDistrict && ctx.scope.districtIds.includes(effDistrict)) || (mandalId && ctx.scope.mandalIds.includes(mandalId));
    if (!ok) flash(back, "err", "You can only assign staff within your own area.");
  }
  return { role, districtId: role.scope === "global" ? null : effDistrict, mandalId: role.scope === "district" || role.scope === "global" ? null : mandalId };
}

export async function createStaffAction(fd: FormData) {
  const ctx = await requirePermission("staff", "create");
  const back = "/admin/staff/new";
  const fullName = str(fd, "fullName");
  const mobile = str(fd, "mobile");
  const email = strOrNull(fd, "email")?.toLowerCase() ?? null;
  if (fullName.length < 2 || !/^[6-9]\d{9}$/.test(mobile)) flash(back, "err", "Enter the staff name and a valid 10-digit mobile.");
  if (email && !/^\S+@\S+\.\S+$/.test(email)) flash(back, "err", "Enter a valid email.");
  const a = await checkAssignment(ctx, str(fd, "roleKey"), strOrNull(fd, "districtId"), strOrNull(fd, "mandalId"), back);
  let photo: string | null = null;
  try {
    photo = await saveUpload(fd.get("photo"), "image");
  } catch (e) {
    flash(back, "err", (e as Error).message);
  }

  const [existing] = await db.select().from(users).where(email ? or(eq(users.mobile, mobile), eq(users.email, email)) : eq(users.mobile, mobile));
  let userId: string;
  let token: string | null = null;
  if (existing) {
    const [dup] = await db.select().from(userRoles).where(and(eq(userRoles.userId, existing.id), eq(userRoles.roleKey, a.role.key)));
    if (dup) flash(back, "err", "This person already holds that role.");
    userId = existing.id;
  } else {
    token = randomToken(24);
    const [u] = await db.insert(users).values({ fullName, mobile, email, photoUrl: fileUrl(photo), status: "invited", passwordHash: await hashPassword(randomToken(16)) }).returning();
    userId = u.id;
    await db.insert(passwordResets).values({ userId, tokenHash: sha256(token), purpose: "activation", expiresAt: new Date(Date.now() + 7 * 86400000) });
  }
  await db.insert(userRoles).values({
    userId, roleKey: a.role.key, districtId: a.districtId, mandalId: a.mandalId, employeeId: strOrNull(fd, "employeeId"),
    reportingOfficerId: strOrNull(fd, "reportingOfficerId"), joiningDate: strOrNull(fd, "joiningDate"), createdBy: ctx.user.id,
  });
  await audit(ctx.user.id, "staff.created", "user", userId, { role: a.role.key });
  await notify(userId, `You have been assigned as ${a.role.name}`, undefined, "/admin/dashboard", "staff");
  flash(`/admin/staff/${userId}${token ? `?act=${token}` : ""}`, "msg", token ? "Staff account created. Share the activation link so they can set their own password." : "Role added to the existing account.");
}

export async function updateStaffRoleAction(fd: FormData) {
  const ctx = await requirePermission("staff", "edit");
  const userRoleId = str(fd, "userRoleId");
  const userId = str(fd, "userId");
  const back = `/admin/staff/${userId}`;
  if (userId === ctx.user.id) flash(back, "err", "You cannot change your own role or area.");
  const [ur] = await db.select().from(userRoles).where(eq(userRoles.id, userRoleId));
  if (!ur) flash(back, "err", "Assignment not found.");
  if (ur.roleKey === "main_admin" && !ctx.isMainAdmin) flash(back, "err", "Only the Main Admin can modify administrators.");
  if (str(fd, "remove") === "1") {
    await db.delete(userRoles).where(eq(userRoles.id, userRoleId));
    await audit(ctx.user.id, "staff.role_removed", "user", userId, { role: ur.roleKey });
    flash(back, "msg", "Role removed.");
  }
  const a = await checkAssignment(ctx, str(fd, "roleKey") || ur.roleKey, strOrNull(fd, "districtId"), strOrNull(fd, "mandalId"), back);
  await db
    .update(userRoles)
    .set({ roleKey: a.role.key, districtId: a.districtId, mandalId: a.mandalId, employeeId: strOrNull(fd, "employeeId"), reportingOfficerId: strOrNull(fd, "reportingOfficerId"), active: fd.get("active") === "on" })
    .where(eq(userRoles.id, userRoleId));
  await audit(ctx.user.id, "staff.role_updated", "user", userId, { role: a.role.key });
  flash(back, "msg", "Assignment updated.");
}

export async function setUserStatusAction(fd: FormData) {
  const ctx = await requirePermission("staff", "edit");
  const userId = str(fd, "userId");
  const back = `/admin/staff/${userId}`;
  if (userId === ctx.user.id) flash(back, "err", "You cannot suspend your own account.");
  const suspend = str(fd, "status") === "suspended";
  const rolesOf = await db.select().from(userRoles).where(eq(userRoles.userId, userId));
  if (rolesOf.some((r) => r.roleKey === "main_admin") && !ctx.isMainAdmin) flash(back, "err", "Only the Main Admin can modify administrators.");
  await db.update(users).set({ status: suspend ? "suspended" : "active" }).where(eq(users.id, userId));
  if (suspend) await db.delete(sessions).where(eq(sessions.userId, userId));
  await audit(ctx.user.id, suspend ? "staff.suspended" : "staff.activated", "user", userId);
  flash(back, "msg", suspend ? "Account suspended and sessions revoked." : "Account activated.");
}

export async function revokeSessionsAction(fd: FormData) {
  const ctx = await requirePermission("staff", "edit");
  const userId = str(fd, "userId");
  await db.delete(sessions).where(eq(sessions.userId, userId));
  await audit(ctx.user.id, "staff.sessions_revoked", "user", userId);
  flash(`/admin/staff/${userId}`, "msg", "All sessions revoked. The user must log in again.");
}
