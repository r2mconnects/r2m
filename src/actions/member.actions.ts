"use server";

import { and, eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import {
  bloodDonors, bloodRequests, eventRegistrations, events, memberDocuments, members, notifications, supportTickets, users,
  emergencyRequests,
} from "@/db/schema";
import { hashPassword, passwordProblem, verifyPassword } from "@/lib/auth/password";
import { getAuth, requireMember, requireUser } from "@/lib/auth/session";
import { audit } from "@/lib/audit";
import { fileUrl, saveUpload } from "@/lib/uploads";
import { flash, intOrNull, str, strOrNull } from "@/lib/utils";
import { notifyMany } from "@/lib/notifications/notify";
import { userRoles } from "@/db/schema";

export async function updateProfileAction(fd: FormData) {
  const ctx = await requireMember();
  const back = "/member/profile";
  let photo: string | null = null;
  try {
    photo = await saveUpload(fd.get("photo"), "image");
  } catch (e) {
    flash(back, "err", (e as Error).message);
  }
  const email = strOrNull(fd, "email")?.toLowerCase() ?? null;
  if (email && !/^\S+@\S+\.\S+$/.test(email)) flash(back, "err", "Enter a valid email.");
  try {
    await db
      .update(members)
      .set({
        email,
        dob: strOrNull(fd, "dob"),
        address: strOrNull(fd, "address"),
        village: strOrNull(fd, "village"),
        workshopName: strOrNull(fd, "workshopName"),
        workshopAddress: strOrNull(fd, "workshopAddress"),
        experienceYears: intOrNull(fd, "experienceYears"),
        specialization: strOrNull(fd, "specialization"),
        services: strOrNull(fd, "services"),
        workingHours: strOrNull(fd, "workingHours"),
        emergencyName: strOrNull(fd, "emergencyName"),
        emergencyPhone: strOrNull(fd, "emergencyPhone"),
        nomineeName: strOrNull(fd, "nomineeName"),
        nomineeRelation: strOrNull(fd, "nomineeRelation"),
        directoryOptIn: fd.get("directoryOptIn") === "on",
        ...(photo ? { photoUrl: fileUrl(photo) } : {}),
      })
      .where(eq(members.id, ctx.member.id));
    await db.update(users).set({ email, ...(photo ? { photoUrl: fileUrl(photo) } : {}) }).where(eq(users.id, ctx.user.id));
  } catch {
    flash(back, "err", "That email is already used by another account.");
  }
  await audit(ctx.user.id, "member.profile_updated", "member", ctx.member.id);
  revalidatePath("/member");
  flash(back, "msg", "Profile updated.");
}

export async function requestChangeAction(fd: FormData) {
  const ctx = await requireMember();
  const detail = str(fd, "detail");
  if (detail.length < 5) flash("/member/profile", "err", "Describe the change you need.");
  await db.insert(supportTickets).values({ userId: ctx.user.id, subject: "Profile change request (name / mobile / location)", message: detail });
  flash("/member/profile", "msg", "Request sent. An administrator will verify and apply the change.");
}

export async function uploadDocumentAction(fd: FormData) {
  const ctx = await requireMember();
  const back = "/member/documents";
  let name: string | null = null;
  try {
    name = await saveUpload(fd.get("file"), "document");
  } catch (e) {
    flash(back, "err", (e as Error).message);
  }
  if (!name) flash(back, "err", "Choose a file to upload.");
  await db.insert(memberDocuments).values({
    memberId: ctx.member.id, docType: str(fd, "docType") || "other", fileName: name, originalName: (fd.get("file") as File).name,
  });
  flash(back, "msg", "Document uploaded securely.");
}

export async function changePasswordAction(fd: FormData) {
  const ctx = await requireUser();
  const back = ctx.member ? "/member/settings" : "/admin/dashboard";
  const [u] = await db.select().from(users).where(eq(users.id, ctx.user.id));
  if (!(await verifyPassword(String(fd.get("current") ?? ""), u.passwordHash))) flash(back, "err", "Current password is incorrect.");
  const pw = String(fd.get("password") ?? "");
  const problem = passwordProblem(pw);
  if (problem) flash(back, "err", problem);
  if (pw !== String(fd.get("confirm") ?? "")) flash(back, "err", "Passwords do not match.");
  await db.update(users).set({ passwordHash: await hashPassword(pw) }).where(eq(users.id, u.id));
  await audit(u.id, "auth.password_changed", "user", u.id);
  flash(back, "msg", "Password changed.");
}

export async function setLanguageAction(fd: FormData) {
  const lang = str(fd, "lang") === "te" ? "te" : "en";
  const jar = await cookies();
  jar.set("r2m_lang", lang, { path: "/", maxAge: 31536000 });
  const ctx = await getAuth();
  if (ctx) await db.update(users).set({ language: lang }).where(eq(users.id, ctx.user.id));
  revalidatePath("/", "layout");
  flash(str(fd, "back") || "/member/settings", "msg", lang === "te" ? "భాష తెలుగుకు మార్చబడింది." : "Language set to English.");
}

export async function createTicketAction(fd: FormData) {
  const ctx = await requireUser();
  const subject = str(fd, "subject");
  const message = str(fd, "message");
  if (!subject || !message) flash("/member/support", "err", "Enter a subject and message.");
  await db.insert(supportTickets).values({ userId: ctx.user.id, subject, message });
  flash("/member/support", "msg", "Your request has been submitted. We will reply here.");
}

export async function markAllReadAction() {
  const ctx = await requireUser();
  await db.update(notifications).set({ readAt: new Date() }).where(and(eq(notifications.userId, ctx.user.id)));
  revalidatePath("/notifications");
  flash("/notifications", "msg", "All notifications marked as read.");
}

export async function registerEventAction(fd: FormData) {
  const ctx = await requireMember();
  const id = str(fd, "eventId");
  const back = `/events/${id}`;
  const [e] = await db.select().from(events).where(eq(events.id, id));
  if (!e || e.status !== "published" || !e.registrationOpen) flash(back, "err", "Registration is closed.");
  if (str(fd, "cancel") === "1") {
    await db.delete(eventRegistrations).where(and(eq(eventRegistrations.eventId, id), eq(eventRegistrations.memberId, ctx.member.id)));
    flash(back, "msg", "Registration cancelled.");
  }
  await db.insert(eventRegistrations).values({ eventId: id, memberId: ctx.member.id }).onConflictDoNothing();
  flash(back, "msg", "You are registered for this event.");
}

export async function saveDonorAction(fd: FormData) {
  const ctx = await requireMember();
  const group = str(fd, "bloodGroup");
  if (!group) flash("/blood-donors", "err", "Select your blood group.");
  if (fd.get("consent") !== "on") flash("/blood-donors", "err", "Consent is required to join the donor network.");
  const vals = {
    bloodGroup: group,
    districtId: ctx.member.districtId,
    mandalId: ctx.member.mandalId,
    location: strOrNull(fd, "location"),
    available: fd.get("available") === "on",
    consent: true,
  };
  await db.insert(bloodDonors).values({ memberId: ctx.member.id, ...vals }).onConflictDoUpdate({ target: bloodDonors.memberId, set: vals });
  flash("/blood-donors", "msg", "Donor profile saved.");
}

export async function withdrawDonorAction() {
  const ctx = await requireMember();
  await db.delete(bloodDonors).where(eq(bloodDonors.memberId, ctx.member.id));
  flash("/blood-donors", "msg", "You have been removed from the donor network.");
}

export async function bloodRequestAction(fd: FormData) {
  const ctx = await requireMember();
  const group = str(fd, "bloodGroup");
  const hospital = str(fd, "hospital");
  const phone = str(fd, "contactPhone");
  if (!group || !hospital || !/^[6-9]\d{9}$/.test(phone)) flash("/blood-donors", "err", "Enter blood group, hospital and a valid contact number.");
  await db.insert(bloodRequests).values({
    requesterId: ctx.user.id, bloodGroup: group, units: intOrNull(fd, "units") ?? 1, hospital, contactPhone: phone,
    districtId: ctx.member.districtId, mandalId: ctx.member.mandalId, note: strOrNull(fd, "note"),
  });
  const donors = await db
    .select({ userId: members.userId })
    .from(bloodDonors)
    .innerJoin(members, eq(members.id, bloodDonors.memberId))
    .where(and(eq(bloodDonors.bloodGroup, group), eq(bloodDonors.available, true), eq(bloodDonors.consent, true), eq(bloodDonors.districtId, ctx.member.districtId ?? "")));
  await notifyMany(donors.map((d) => d.userId!).filter(Boolean), `Blood needed: ${group}`, `${hospital}. Contact ${phone}.`, "/blood-donors", "blood");
  flash("/blood-donors", "msg", `Request posted. ${donors.length} available donor(s) in your district were notified.`);
}

export async function sosAction(fd: FormData) {
  const ctx = await requireMember();
  const message = str(fd, "message") || "Emergency assistance needed";
  const lat = parseFloat(str(fd, "lat"));
  const lng = parseFloat(str(fd, "lng"));
  const share = fd.get("shareLocation") === "on" && Number.isFinite(lat) && Number.isFinite(lng);
  const [r] = await db
    .insert(emergencyRequests)
    .values({ memberId: ctx.member.id, message, lat: share ? lat : null, lng: share ? lng : null })
    .returning();
  await notifyEmergencyStaff(ctx.member.fullName, r.id);
  await audit(ctx.user.id, "emergency.sos_submitted", "emergency_request", r.id);
  flash("/emergency", "msg", "SOS request submitted. This is NOT yet a confirmed response — a coordinator will acknowledge it. In danger, call the emergency numbers below immediately.");
}

async function notifyEmergencyStaff(name: string, id: string) {
  const rows = await db
    .select({ userId: userRoles.userId, key: userRoles.roleKey })
    .from(userRoles)
    .where(eq(userRoles.active, true));
  const ids = Array.from(new Set(rows.filter((r) => ["main_admin", "welfare_officer"].includes(r.key)).map((r) => r.userId)));
  await notifyMany(ids, "SOS request", `${name} has submitted an emergency request.`, `/admin/emergency#${id}`, "emergency");
}
