"use server";

import { and, count, eq, gt, isNull, or, sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { loginAttempts, members, passwordResets, roles, sessions, userRoles, users } from "@/db/schema";
import { hashPassword, passwordProblem, verifyPassword } from "@/lib/auth/password";
import { createSession, destroySession, getAuth } from "@/lib/auth/session";
import { audit } from "@/lib/audit";
import { createMember } from "@/lib/membership/register";
import { notifyMany } from "@/lib/notifications/notify";
import { flash, sha256, str } from "@/lib/utils";
import { ensureSeed } from "@/lib/seed";

async function landingFor(userId: string) {
  const rows = await db.select({ key: userRoles.roleKey }).from(userRoles).where(and(eq(userRoles.userId, userId), eq(userRoles.active, true)));
  const staff = rows.some((r) => r.key !== "member");
  const [m] = await db.select({ id: members.id }).from(members).where(eq(members.userId, userId));
  if (rows.some((r) => r.key === "main_admin")) return "/admin/dashboard";
  if (staff && !m) return "/admin/dashboard";
  return m ? "/home" : "/unauthorized";
}

export async function loginAction(fd: FormData) {
  await ensureSeed();
  const identifier = str(fd, "identifier").toLowerCase();
  const password = String(fd.get("password") ?? "");
  if (!identifier || !password) flash("/login", "err", "Enter your mobile number or email and password.");

  // Rate limit: 5 failed attempts per identifier in 15 minutes.
  const since = new Date(Date.now() - 15 * 60 * 1000);
  const [{ n }] = await db
    .select({ n: count() })
    .from(loginAttempts)
    .where(and(eq(loginAttempts.identifier, identifier), eq(loginAttempts.success, false), gt(loginAttempts.createdAt, since)));
  if (n >= 5) flash("/login", "err", "Too many failed attempts. Please try again in 15 minutes.");

  const [u] = await db.select().from(users).where(or(eq(users.email, identifier), eq(users.mobile, identifier))).limit(1);
  const ok = u ? await verifyPassword(password, u.passwordHash) : false;
  await db.insert(loginAttempts).values({ identifier, success: ok });
  if (!u || !ok) flash("/login", "err", "Invalid credentials.");
  if (u.status === "suspended") flash("/login", "err", "This account is suspended. Contact the association office.");
  if (u.status === "invited") flash("/login", "err", "Your account is not activated yet. Use the activation link you were given.");

  await createSession(u.id, fd.get("remember") === "on");
  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, u.id));
  const jar = await cookies();
  jar.set("r2m_lang", u.language === "te" ? "te" : "en", { path: "/", maxAge: 31536000 });
  const dest = await landingFor(u.id);
  if (dest.startsWith("/admin")) await audit(u.id, "auth.login", "user", u.id);
  redirect(dest);
}

export async function logoutAction() {
  const ctx = await getAuth();
  if (ctx?.isStaff) await audit(ctx.user.id, "auth.logout", "user", ctx.user.id);
  await destroySession();
  redirect("/login");
}

export async function registerAction(fd: FormData) {
  await ensureSeed();
  const password = String(fd.get("password") ?? "");
  if (password !== String(fd.get("confirm") ?? "")) flash("/register", "err", "Passwords do not match.");
  const problem = passwordProblem(password);
  if (problem) flash("/register", "err", problem);
  if (fd.get("consent") !== "on") flash("/register", "err", "Please accept the Terms and Privacy Policy to continue.");
  const res = await createMember(fd, { password });
  if (!res.ok) flash("/register", "err", res.error);
  const [m] = await db.select({ userId: members.userId }).from(members).where(eq(members.id, res.memberId));
  if (m?.userId) await createSession(m.userId, false);
  redirect(`/home?msg=${encodeURIComponent(`Application ${res.ref} submitted. You will be notified after review.`)}`);
}

export async function forgotPasswordAction(fd: FormData) {
  const identifier = str(fd, "identifier").toLowerCase();
  const [u] = identifier ? await db.select().from(users).where(or(eq(users.email, identifier), eq(users.mobile, identifier))).limit(1) : [];
  if (u) {
    await audit(u.id, "auth.password_reset_requested", "user", u.id);
    const admins = await db
      .select({ id: userRoles.userId })
      .from(userRoles)
      .where(and(eq(userRoles.roleKey, "main_admin"), eq(userRoles.active, true)));
    await notifyMany(
      admins.map((a) => a.id),
      "Password reset requested",
      `${u.fullName} (${u.mobile ?? u.email}) asked for a password reset. Open their profile to generate a secure reset link.`,
      "/admin/members",
      "security",
    );
  }
  flash(
    "/forgot-password",
    "msg",
    "If an account exists, the association office has been notified and will send you a secure reset link. (Automatic email/SMS delivery is available once a provider is configured.)",
  );
}

export async function resetPasswordAction(fd: FormData) {
  const token = str(fd, "token");
  const back = `/reset-password?token=${encodeURIComponent(token)}`;
  const pw = String(fd.get("password") ?? "");
  if (pw !== String(fd.get("confirm") ?? "")) flash(back, "err", "Passwords do not match.");
  const problem = passwordProblem(pw);
  if (problem) flash(back, "err", problem);
  const [r] = await db
    .select()
    .from(passwordResets)
    .where(and(eq(passwordResets.tokenHash, sha256(token)), isNull(passwordResets.usedAt), gt(passwordResets.expiresAt, new Date())));
  if (!r) flash("/login", "err", "This link is invalid or has expired. Ask the association office for a new one.");
  await db.transaction(async (tx) => {
    await tx.update(users).set({ passwordHash: await hashPassword(pw), status: "active" }).where(eq(users.id, r.userId));
    await tx.update(passwordResets).set({ usedAt: new Date() }).where(eq(passwordResets.id, r.id));
    await tx.delete(sessions).where(eq(sessions.userId, r.userId)); // revoke all sessions
  });
  await audit(r.userId, r.purpose === "activation" ? "auth.account_activated" : "auth.password_reset", "user", r.userId);
  flash("/login", "msg", "Password saved. You can now log in.");
}

export async function setupAdminAction(fd: FormData) {
  await ensureSeed();
  const required = process.env.ADMIN_SETUP_TOKEN;
  if (!required && process.env.NODE_ENV === "production") flash("/setup", "err", "Set ADMIN_SETUP_TOKEN on the server before creating the Main Admin.");
  if (required && str(fd, "setupToken") !== required) flash("/setup", "err", "Invalid setup token.");
  const pw = String(fd.get("password") ?? "");
  const problem = passwordProblem(pw);
  if (problem || pw.length < 10) flash("/setup", "err", problem ?? "Use at least 10 characters for the Main Admin password.");
  if (pw !== String(fd.get("confirm") ?? "")) flash("/setup", "err", "Passwords do not match.");
  const email = str(fd, "email").toLowerCase();
  const fullName = str(fd, "fullName");
  if (!fullName || !/^\S+@\S+\.\S+$/.test(email)) flash("/setup", "err", "Enter a name and a valid email.");
  const mobile = str(fd, "mobile") || null;

  const done = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(7001)`);
    const [{ n }] = await tx.select({ n: count() }).from(userRoles).where(eq(userRoles.roleKey, "main_admin"));
    if (n > 0) return false;
    const [role] = await tx.select().from(roles).where(eq(roles.key, "main_admin"));
    if (!role) throw new Error("Roles not seeded");
    const [u] = await tx.insert(users).values({ fullName, email, mobile, passwordHash: await hashPassword(pw) }).returning();
    await tx.insert(userRoles).values({ userId: u.id, roleKey: "main_admin" });
    await audit(u.id, "setup.main_admin_created", "user", u.id);
    return true;
  });
  if (!done) flash("/login", "err", "Setup is already complete.");
  flash("/login", "msg", "Main Admin created. Please log in.");
}
