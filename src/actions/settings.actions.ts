"use server";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { districts, emergencyContacts, expenses, mandals, membershipPlans, roles } from "@/db/schema";
import { ACTIONS, MODULES } from "@/constants/roles";
import { requirePermission } from "@/lib/auth/session";
import { audit } from "@/lib/audit";
import { runReminders } from "@/lib/membership/reminders";
import { saveSetting } from "@/lib/settings";
import { fileUrl, saveUpload } from "@/lib/uploads";
import { flash, intOrNull, rupeesToPaise, slugify, str, strOrNull } from "@/lib/utils";

export async function saveSettingsAction(fd: FormData) {
  const ctx = await requirePermission("settings", "edit");
  const back = "/admin/settings";
  const text = ["associationName", "shortName", "tagline", "contactPhone", "contactEmail", "contactAddress", "presidentName", "terms", "privacy", "reminderDays"] as const;
  for (const k of text) if (fd.has(k)) await saveSetting(k, str(fd, k));
  const prefix = str(fd, "membershipPrefix").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (prefix) await saveSetting("membershipPrefix", prefix);
  if (str(fd, "paymentPolicy")) await saveSetting("paymentPolicy", str(fd, "paymentPolicy") === "before_approval" ? "before_approval" : "after_approval");
  if (fd.has("deliveryChargeRs")) {
    await saveSetting("deliveryChargePaise", rupeesToPaise(fd.get("deliveryChargeRs")));
    await saveSetting("freeDeliveryAbovePaise", rupeesToPaise(fd.get("freeDeliveryAboveRs")));
    await saveSetting("codEnabled", fd.get("codEnabled") === "on");
    await saveSetting("pickupEnabled", fd.get("pickupEnabled") === "on");
    await saveSetting("commissionPerRegistrationPaise", rupeesToPaise(fd.get("commissionRs")));
  }
  try {
    const sig = await saveUpload(fd.get("signature"), "image");
    if (sig) await saveSetting("presidentSignatureUrl", fileUrl(sig));
  } catch (e) {
    flash(back, "err", (e as Error).message);
  }
  await audit(ctx.user.id, "settings.updated", "settings", null);
  flash(back, "msg", "Settings saved.");
}

export async function saveDistrictAction(fd: FormData) {
  const id = str(fd, "id");
  const ctx = await requirePermission("geography", id ? "edit" : "create");
  const name = str(fd, "name");
  if (!name) flash("/admin/districts", "err", "Enter the district name.");
  try {
    if (id) await db.update(districts).set({ name, active: fd.get("active") === "on" }).where(eq(districts.id, id));
    else await db.insert(districts).values({ name, sortOrder: 99 });
  } catch {
    flash("/admin/districts", "err", "That district already exists.");
  }
  await audit(ctx.user.id, "district.saved", "district", id || null, { name });
  flash("/admin/districts", "msg", "District saved.");
}

export async function saveMandalAction(fd: FormData) {
  const id = str(fd, "id");
  const ctx = await requirePermission("geography", id ? "edit" : "create");
  const name = str(fd, "name");
  const districtId = str(fd, "districtId");
  if (!name || !districtId) flash("/admin/mandals", "err", "Enter the mandal name and district.");
  try {
    if (id) await db.update(mandals).set({ name, districtId, active: fd.get("active") === "on" }).where(eq(mandals.id, id));
    else await db.insert(mandals).values({ name, districtId });
  } catch {
    flash("/admin/mandals", "err", "That mandal already exists in the district.");
  }
  await audit(ctx.user.id, "mandal.saved", "mandal", id || null, { name });
  flash(`/admin/mandals?districtId=${districtId}`, "msg", "Mandal saved.");
}

export async function savePlanAction(fd: FormData) {
  const id = str(fd, "id");
  const ctx = await requirePermission("plans", id ? "edit" : "create");
  const name = str(fd, "name");
  if (!name) flash("/admin/memberships", "err", "Plan name is required.");
  const vals = {
    name, joiningFeePaise: rupeesToPaise(fd.get("joining")), applicationFeePaise: rupeesToPaise(fd.get("application")), renewalFeePaise: rupeesToPaise(fd.get("renewal")),
    lateFeePaise: rupeesToPaise(fd.get("late")), graceDays: intOrNull(fd, "graceDays") ?? 0, validityMonths: Math.max(1, intOrNull(fd, "validityMonths") ?? 12), active: fd.get("active") === "on",
  };
  if (id) await db.update(membershipPlans).set(vals).where(eq(membershipPlans.id, id));
  else await db.insert(membershipPlans).values(vals);
  await audit(ctx.user.id, "plan.saved", "membership_plan", id || null, vals);
  flash("/admin/memberships", "msg", "Plan saved.");
}

export async function saveRoleAction(fd: FormData) {
  const ctx = await requirePermission("roles", "manage");
  const key = str(fd, "key");
  const back = "/admin/roles";
  if (key === "main_admin") flash(back, "err", "The Main Admin role always has full access and cannot be edited.");
  const [role] = await db.select().from(roles).where(eq(roles.key, key));
  if (!role) flash(back, "err", "Role not found.");
  const perms: Record<string, string[]> = {};
  for (const m of MODULES) {
    const acts = ACTIONS.filter((a) => fd.get(`p_${m.key}_${a}`) === "on");
    if (acts.length) perms[m.key] = acts;
  }
  await db.update(roles).set({ permissions: role.key === "member" ? {} : perms, name: str(fd, "name") || role.name, level: intOrNull(fd, "level") ?? role.level }).where(eq(roles.key, key));
  await audit(ctx.user.id, "role.permissions_updated", "role", key, { permissions: perms });
  flash(back, "msg", `${role.name} updated.`);
}

export async function createRoleAction(fd: FormData) {
  const ctx = await requirePermission("roles", "manage");
  const name = str(fd, "name");
  const key = slugify(name).replace(/-/g, "_");
  if (!name || !key) flash("/admin/roles", "err", "Enter a role name.");
  const scope = ["global", "district", "mandal", "agent"].includes(str(fd, "scope")) ? str(fd, "scope") : "global";
  try {
    await db.insert(roles).values({ key, name, scope, level: intOrNull(fd, "level") ?? 50, description: strOrNull(fd, "description"), permissions: {} });
  } catch {
    flash("/admin/roles", "err", "A role with this name exists.");
  }
  await audit(ctx.user.id, "role.created", "role", key);
  flash("/admin/roles", "msg", "Custom role created. Tick its permissions below.");
}

export async function addExpenseAction(fd: FormData) {
  const ctx = await requirePermission("payments", "manage");
  const amount = rupeesToPaise(fd.get("amount"));
  if (amount <= 0 || !str(fd, "spentOn")) flash("/admin/payments?tab=expenses", "err", "Enter amount and date.");
  await db.insert(expenses).values({ category: str(fd, "category") || "Other", description: strOrNull(fd, "description"), amountPaise: amount, spentOn: str(fd, "spentOn"), createdBy: ctx.user.id });
  await audit(ctx.user.id, "expense.added", "expense", null, { amount });
  flash("/admin/payments?tab=expenses", "msg", "Expense recorded.");
}

export async function saveEmergencyContactAction(fd: FormData) {
  const ctx = await requirePermission("emergency", "manage");
  if (str(fd, "delete") === "1") {
    await db.delete(emergencyContacts).where(eq(emergencyContacts.id, str(fd, "id")));
    flash("/admin/emergency", "msg", "Contact removed.");
  }
  if (!str(fd, "label") || !/^[0-9+\-\s]{3,15}$/.test(str(fd, "phone"))) flash("/admin/emergency", "err", "Enter a label and a valid phone number.");
  await db.insert(emergencyContacts).values({ label: str(fd, "label"), phone: str(fd, "phone"), kind: str(fd, "kind") || "association", districtId: strOrNull(fd, "districtId") });
  await audit(ctx.user.id, "emergency.contact_added", "emergency_contact", null);
  flash("/admin/emergency", "msg", "Contact added.");
}

/** Marks expired members and sends configured expiry reminders (in-app; external channels when configured). */
export async function runRemindersAction() {
  const ctx = await requirePermission("notifications", "manage");
  const n = await runReminders();
  await audit(ctx.user.id, "reminders.run", "notification", null, { sent: n });
  flash("/admin/notifications", "msg", `Expiry sync complete. ${n} reminder(s) sent.`);
}
