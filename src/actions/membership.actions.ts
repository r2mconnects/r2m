"use server";

import { and, eq, notExists } from "drizzle-orm";
import { db } from "@/db";
import {
  manualCollections, members, membershipCardHistory, membershipCards, paymentTransactions, passwordResets, userRoles, users,
} from "@/db/schema";
import { requirePermission, type AuthCtx } from "@/lib/auth/session";
import { audit } from "@/lib/audit";
import { activateMember, applicationFee, renewalFee } from "@/lib/membership/membership";
import { createMember } from "@/lib/membership/register";
import { notify } from "@/lib/notifications/notify";
import { markTransactionPaid } from "@/lib/payments/verification";
import { inMemberScope } from "@/lib/scope";
import { fileUrl, saveUpload } from "@/lib/uploads";
import { flash, intOrNull, randomToken, rupeesToPaise, sha256, str, strOrNull } from "@/lib/utils";

async function loadMember(ctx: AuthCtx, id: string, back: string) {
  const [m] = await db.select().from(members).where(eq(members.id, id));
  if (!m || !inMemberScope(ctx, m)) flash(back, "err", "Member not found in your area.");
  return m;
}

export async function reviewApplicationAction(fd: FormData) {
  const id = str(fd, "id");
  const decision = str(fd, "decision"); // review | preliminary | approve | reject
  const back = str(fd, "back") || "/admin/applications";
  const ctx = await requirePermission("applications", decision === "reject" ? "reject" : decision === "review" ? "view" : "approve");
  const m = await loadMember(ctx, id, back);
  if (!["pending", "under_review"].includes(m.status)) flash(back, "err", "This application has already been decided.");
  // Separation of duties: agents cannot approve their own registrations.
  if (m.agentId === ctx.user.id && !ctx.isMainAdmin) flash(back, "err", "You cannot approve an application you registered yourself.");

  if (decision === "review" || decision === "preliminary") {
    await db.update(members).set({ status: "under_review" }).where(eq(members.id, id));
    await audit(ctx.user.id, `application.${decision}`, "member", id);
    await notify(m.userId, "Application under review", decision === "preliminary" ? "Your application has preliminary approval. Please complete the membership fee payment." : "Your application is being reviewed.", "/home", "registration");
    flash(back, "msg", decision === "preliminary" ? "Preliminary approval recorded; member can now pay." : "Marked as under review.");
  }
  if (decision === "reject") {
    const reason = str(fd, "reason");
    if (reason.length < 3) flash(back, "err", "A rejection reason is required.");
    await db.update(members).set({ status: "rejected", rejectReason: reason, approvedBy: ctx.user.id, approvedAt: new Date() }).where(eq(members.id, id));
    await audit(ctx.user.id, "application.rejected", "member", id, { reason });
    await notify(m.userId, "Application rejected", reason, "/home", "registration");
    flash(back, "msg", "Application rejected.");
  }
  if (decision === "approve") {
    const fee = await applicationFee(m.id, m.planId);
    if (!fee.paid) flash(back, "err", `The joining fee (₹${fee.amountPaise / 100}) has not been paid and verified yet.`);
    const u = await activateMember(id, ctx.user.id);
    await audit(ctx.user.id, "application.approved", "member", id, { membershipNo: u.membershipNo });
    await notify(m.userId, "Membership approved", `Your membership number is ${u.membershipNo}. Your digital ID card is ready.`, "/member/membership/card", "registration");
    flash(back, "msg", `Approved. Membership number ${u.membershipNo} generated.`);
  }
  flash(back, "err", "Invalid decision.");
}

export async function memberStatusAction(fd: FormData) {
  const id = str(fd, "id");
  const act = str(fd, "act"); // suspend | reactivate
  const back = `/admin/members/${id}`;
  const ctx = await requirePermission("members", act === "reactivate" ? "approve" : "edit");
  const m = await loadMember(ctx, id, "/admin/members");
  if (!m.membershipNo) flash(back, "err", "Only approved members can be suspended or reactivated.");
  if (act === "suspend") {
    const reason = str(fd, "reason");
    if (reason.length < 3) flash(back, "err", "Enter a reason for suspension.");
    await db.update(members).set({ status: "suspended" }).where(eq(members.id, id));
    await db.update(membershipCards).set({ status: "suspended" }).where(eq(membershipCards.memberId, id));
    await db.insert(membershipCardHistory).values({ memberId: id, action: "suspended", note: reason, userId: ctx.user.id });
    await audit(ctx.user.id, "member.suspended", "member", id, { reason });
    await notify(m.userId, "Membership suspended", reason, "/home", "membership");
    flash(back, "msg", "Member suspended and card disabled.");
  }
  if (act === "reactivate") {
    const expired = m.validTill && m.validTill < new Date().toISOString().slice(0, 10);
    await db.update(members).set({ status: expired ? "expired" : "active" }).where(eq(members.id, id));
    await db.update(membershipCards).set({ status: "active" }).where(eq(membershipCards.memberId, id));
    await db.insert(membershipCardHistory).values({ memberId: id, action: "reactivated", userId: ctx.user.id });
    await audit(ctx.user.id, "member.reactivated", "member", id);
    await notify(m.userId, "Membership reactivated", undefined, "/home", "membership");
    flash(back, "msg", expired ? "Reactivated (membership is past its validity — renewal needed)." : "Member reactivated.");
  }
  flash(back, "err", "Invalid action.");
}

export async function cardAdminAction(fd: FormData) {
  const id = str(fd, "id");
  const act = str(fd, "act"); // issue | reissue
  const back = `/admin/members/${id}`;
  const ctx = await requirePermission("cards", "manage");
  const m = await loadMember(ctx, id, "/admin/members");
  if (!m.membershipNo) flash(back, "err", "Approve the membership before issuing a card.");
  if (act === "reissue") {
    await db.update(membershipCards).set({ token: randomToken(20), version: (await db.select().from(membershipCards).where(eq(membershipCards.memberId, id)))[0]?.version + 1 || 2, issuedAt: new Date(), status: "active" }).where(eq(membershipCards.memberId, id));
    await db.insert(membershipCardHistory).values({ memberId: id, action: "reissued", userId: ctx.user.id, note: "Old QR invalidated" });
    flash(back, "msg", "Card reissued. The previous QR code no longer verifies.");
  }
  await db.insert(membershipCards).values({ memberId: id, token: randomToken(20) }).onConflictDoNothing();
  await db.insert(membershipCardHistory).values({ memberId: id, action: "issued", userId: ctx.user.id });
  flash(back, "msg", "Card generated.");
}

export async function bulkIssueCardsAction() {
  const ctx = await requirePermission("cards", "manage");
  const rows = await db
    .select({ id: members.id })
    .from(members)
    .where(and(eq(members.status, "active"), notExists(db.select().from(membershipCards).where(eq(membershipCards.memberId, members.id)))));
  for (const r of rows) {
    await db.insert(membershipCards).values({ memberId: r.id, token: randomToken(20) }).onConflictDoNothing();
    await db.insert(membershipCardHistory).values({ memberId: r.id, action: "issued", userId: ctx.user.id, note: "bulk" });
  }
  await audit(ctx.user.id, "cards.bulk_issued", "membership_card", null, { count: rows.length });
  flash("/admin/memberships", "msg", `${rows.length} card(s) generated.`);
}

export async function updateMemberAction(fd: FormData) {
  const id = str(fd, "id");
  const back = `/admin/members/${id}`;
  const ctx = await requirePermission("members", "edit");
  await loadMember(ctx, id, "/admin/members");
  let photo: string | null = null;
  try {
    photo = await saveUpload(fd.get("photo"), "image");
  } catch (e) {
    flash(back, "err", (e as Error).message);
  }
  if (str(fd, "fullName").length < 2) flash(back, "err", "Name is required.");
  try {
    const patch = {
      fullName: str(fd, "fullName"), mobile: str(fd, "mobile"), email: strOrNull(fd, "email")?.toLowerCase() ?? null,
      districtId: strOrNull(fd, "districtId"), mandalId: strOrNull(fd, "mandalId"), village: strOrNull(fd, "village"),
      address: strOrNull(fd, "address"), workshopName: strOrNull(fd, "workshopName"), workshopAddress: strOrNull(fd, "workshopAddress"),
      experienceYears: intOrNull(fd, "experienceYears"), specialization: strOrNull(fd, "specialization"),
      directoryVerified: fd.get("directoryVerified") === "on", ...(photo ? { photoUrl: fileUrl(photo) } : {}),
    };
    const [m] = await db.update(members).set(patch).where(eq(members.id, id)).returning();
    if (m.userId) await db.update(users).set({ fullName: patch.fullName, mobile: patch.mobile, email: patch.email, ...(photo ? { photoUrl: fileUrl(photo) } : {}) }).where(eq(users.id, m.userId));
  } catch {
    flash(back, "err", "Could not save — mobile or email may belong to another account.");
  }
  await audit(ctx.user.id, "member.updated", "member", id);
  flash(back, "msg", "Member updated.");
}

export async function createMemberByStaffAction(fd: FormData) {
  const ctx = await requirePermission("members", "create");
  const res = await createMember(fd, { agentId: ctx.user.id });
  if (!res.ok) flash("/admin/members/new", "err", res.error);
  flash(`/admin/members/${res.memberId}?act=${res.activationToken}`, "msg", `Application ${res.ref} created. Share the activation link with the member so they can set a password.`);
}

export async function resetLinkAction(fd: FormData) {
  const userId = str(fd, "userId");
  const back = str(fd, "back") || "/admin/members";
  const ctx = await requirePermission(str(fd, "module") === "staff" ? "staff" : "members", "edit");
  const [u] = await db.select().from(users).where(eq(users.id, userId));
  if (!u) flash(back, "err", "User not found.");
  const target = await db.select().from(userRoles).where(eq(userRoles.userId, userId));
  if (target.some((r) => r.roleKey === "main_admin") && !ctx.isMainAdmin) flash(back, "err", "Only the Main Admin can reset this account.");
  const token = randomToken(24);
  await db.insert(passwordResets).values({ userId, tokenHash: sha256(token), purpose: u.status === "invited" ? "activation" : "reset", expiresAt: new Date(Date.now() + 86400000 * (u.status === "invited" ? 7 : 1)) });
  await audit(ctx.user.id, "auth.reset_link_issued", "user", userId);
  const sep = back.includes("?") ? "&" : "?";
  flash(`${back}${sep}act=${token}`, "msg", "Secure link generated (single use). Share it with the user.");
}

export async function recordCollectionAction(fd: FormData) {
  const ctx = await requirePermission("collections", "create");
  const id = str(fd, "memberId");
  const back = str(fd, "back") || "/admin/payments?tab=collections";
  const m = await loadMember(ctx, id, back);
  const amount = rupeesToPaise(fd.get("amount"));
  const purpose = str(fd, "purpose") === "renewal" ? "renewal" : "application_fee";
  if (amount <= 0) flash(back, "err", "Enter the amount collected.");
  if (purpose === "renewal" && !m.membershipNo) flash(back, "err", "Renewals apply to approved members only.");
  if (purpose === "application_fee" && m.membershipNo) flash(back, "err", "This member has already joined; record a renewal instead.");
  const method = ["cash", "upi", "bank"].includes(str(fd, "method")) ? str(fd, "method") : "cash";
  await db.insert(manualCollections).values({ memberId: id, amountPaise: amount, method, purpose, reference: strOrNull(fd, "reference"), notes: strOrNull(fd, "notes"), collectedBy: ctx.user.id });
  await audit(ctx.user.id, "collection.recorded", "member", id, { amountPaise: amount, method, purpose });
  flash(back, "msg", "Collection recorded. It becomes a payment only after finance verifies it.");
}

export async function verifyCollectionAction(fd: FormData) {
  const id = str(fd, "id");
  const verdict = str(fd, "verdict"); // approve | reject
  const back = "/admin/payments?tab=collections";
  const ctx = await requirePermission("collections", verdict === "reject" ? "reject" : "approve");
  const [c] = await db.select().from(manualCollections).where(eq(manualCollections.id, id));
  if (!c || c.status !== "pending") flash(back, "err", "Collection is not pending.");
  if (c.collectedBy === ctx.user.id && !ctx.isMainAdmin) flash(back, "err", "You cannot verify a collection you recorded yourself.");
  const [m] = await db.select().from(members).where(eq(members.id, c.memberId));
  if (verdict === "reject") {
    await db.update(manualCollections).set({ status: "rejected", verifiedBy: ctx.user.id, verifiedAt: new Date(), notes: str(fd, "reason") || c.notes }).where(eq(manualCollections.id, id));
    await audit(ctx.user.id, "collection.rejected", "manual_collection", id);
    flash(back, "msg", "Collection rejected.");
  }
  const kind = c.purpose === "renewal" ? "renewal" : "membership_fee";
  const fee = kind === "renewal" ? await renewalFee(m) : await applicationFee(m.id, m.planId);
  const [t] = await db
    .insert(paymentTransactions)
    .values({
      kind, memberId: c.memberId, userId: m.userId, amountPaise: c.amountPaise, method: c.method, status: "created",
      purpose: kind === "renewal" ? "Membership renewal (manual collection)" : "Membership joining fee (manual collection)", planId: fee.plan?.id, collectedBy: c.collectedBy,
    })
    .returning();
  await markTransactionPaid(t.id, { verifiedBy: ctx.user.id });
  await db.update(manualCollections).set({ status: "verified", verifiedBy: ctx.user.id, verifiedAt: new Date(), transactionId: t.id }).where(eq(manualCollections.id, id));
  await audit(ctx.user.id, "collection.verified", "manual_collection", id, { amountPaise: c.amountPaise });
  flash(back, "msg", "Collection verified and receipt generated.");
}

