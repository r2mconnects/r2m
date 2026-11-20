"use server";

import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  emergencyRequests, members, welfareApplications, welfareApprovals, welfareDisbursements, welfareSchemes, type WelfareDoc,
} from "@/db/schema";
import { requireMember, requirePermission, type AuthCtx } from "@/lib/auth/session";
import { audit } from "@/lib/audit";
import { notify } from "@/lib/notifications/notify";
import { inMemberScope } from "@/lib/scope";
import { saveUpload } from "@/lib/uploads";
import { flash, rupeesToPaise, str, strOrNull } from "@/lib/utils";

export async function applyWelfareAction(fd: FormData) {
  const ctx = await requireMember();
  const back = "/welfare/apply";
  if (ctx.member.status !== "active") flash("/welfare", "err", "Welfare services are available to active members only.");
  const schemeId = str(fd, "schemeId");
  const reason = str(fd, "reason");
  if (!schemeId || reason.length < 5) flash(back, "err", "Select a scheme and describe the reason.");
  if (fd.get("consent") !== "on") flash(back, "err", "Consent is required to submit the application.");
  const [scheme] = await db.select().from(welfareSchemes).where(eq(welfareSchemes.id, schemeId));
  if (!scheme || !scheme.active) flash(back, "err", "This scheme is not available.");
  const requested = str(fd, "requested") ? rupeesToPaise(fd.get("requested")) : null;
  if (requested && scheme.maxAmountPaise && requested > scheme.maxAmountPaise) flash(back, "err", "Requested amount exceeds the scheme limit.");

  const docs: WelfareDoc[] = [];
  try {
    for (const f of fd.getAll("docs")) {
      const name = await saveUpload(f, "document");
      if (name) docs.push({ name: (f as File).name, file: name });
    }
  } catch (e) {
    flash(back, "err", (e as Error).message);
  }
  const r = await db.execute(sql`select nextval('application_seq') as n`);
  const refNo = `WEL-${new Date().getFullYear()}-${String((r.rows[0] as { n: string }).n).padStart(5, "0")}`;
  const stage = scheme.approvalLevels[0] ?? "committee";
  const [app] = await db
    .insert(welfareApplications)
    .values({
      refNo, schemeId, memberId: ctx.member.id, reason, description: strOrNull(fd, "description"), requestedPaise: requested,
      emergencyContact: strOrNull(fd, "emergencyContact"), consent: true, documents: docs, currentStage: stage,
    })
    .returning();
  await audit(ctx.user.id, "welfare.submitted", "welfare_application", app.id, { refNo });
  flash(`/welfare/${app.id}`, "msg", `Application ${refNo} submitted.`);
}

function stageAllowed(ctx: AuthCtx, stage: string) {
  if (ctx.isMainAdmin) return true;
  const keys = ctx.roles.map((r) => r.roleKey);
  if (stage === "mandal") return keys.some((k) => k.startsWith("mandal_"));
  if (stage === "district") return keys.some((k) => k.startsWith("district_") || k.startsWith("zone_"));
  if (stage === "welfare_officer") return keys.includes("welfare_officer");
  return false;
}

async function loadApp(ctx: AuthCtx, id: string) {
  const [row] = await db
    .select({ w: welfareApplications, scheme: welfareSchemes, m: members })
    .from(welfareApplications)
    .innerJoin(welfareSchemes, eq(welfareSchemes.id, welfareApplications.schemeId))
    .innerJoin(members, eq(members.id, welfareApplications.memberId))
    .where(eq(welfareApplications.id, id));
  if (!row || !inMemberScope(ctx, row.m)) flash("/admin/welfare", "err", "Application not found in your area.");
  return row;
}

export async function reviewWelfareAction(fd: FormData) {
  const ctx = await requirePermission("welfare", "edit");
  const id = str(fd, "id");
  const back = `/admin/welfare?tab=applications&open=${id}`;
  const decision = str(fd, "decision"); // recommend | more_info | reject
  const comment = str(fd, "comment");
  const { w, scheme, m } = await loadApp(ctx, id);
  if (["approved", "rejected", "payment_pending", "disbursed", "closed"].includes(w.status)) flash(back, "err", "This application is already decided.");
  if (w.currentStage === "committee" || w.currentStage === "finance") {
    if (decision === "recommend") flash(back, "err", "Review stages are complete. The committee decides next.");
  } else if (!stageAllowed(ctx, w.currentStage)) flash(back, "err", `Only the ${w.currentStage.replace("_", " ")} reviewer can act at this stage.`);
  if (decision !== "recommend" && comment.length < 3) flash(back, "err", "A reason/comment is required.");

  let status = w.status;
  let stage = w.currentStage;
  if (decision === "recommend") {
    const levels = scheme.approvalLevels;
    const idx = levels.indexOf(w.currentStage);
    const next = idx >= 0 ? levels[idx + 1] : undefined;
    if (next) { stage = next; status = "under_review"; } else { stage = "committee"; status = "recommended"; }
  } else if (decision === "more_info") status = "more_info";
  else if (decision === "reject") { status = "rejected"; stage = "done"; }
  else flash(back, "err", "Invalid decision.");

  await db.update(welfareApplications).set({ status, currentStage: stage, decisionReason: decision === "recommend" ? w.decisionReason : comment, updatedAt: new Date() }).where(eq(welfareApplications.id, id));
  await db.insert(welfareApprovals).values({ applicationId: id, stage: w.currentStage, decision, comment: comment || null, userId: ctx.user.id });
  await audit(ctx.user.id, `welfare.${decision}`, "welfare_application", id, { stage: w.currentStage });
  await notify(m.userId, `Welfare application ${w.refNo}: ${status.replace(/_/g, " ")}`, comment || undefined, `/welfare/${id}`, "welfare");
  flash(back, "msg", "Decision recorded.");
}

export async function approveWelfareAction(fd: FormData) {
  const ctx = await requirePermission("welfare", "approve");
  const id = str(fd, "id");
  const back = `/admin/welfare?tab=applications&open=${id}`;
  const { w, scheme, m } = await loadApp(ctx, id);
  if (w.currentStage !== "committee" || w.status !== "recommended") flash(back, "err", "Only recommended applications can be approved by the committee.");
  const amount = rupeesToPaise(fd.get("amount"));
  if (scheme.maxAmountPaise && amount > scheme.maxAmountPaise) flash(back, "err", "Amount exceeds the scheme limit.");
  const status = amount > 0 ? "payment_pending" : "approved";
  await db.update(welfareApplications).set({ status, approvedPaise: amount, approvedBy: ctx.user.id, currentStage: amount > 0 ? "finance" : "done", decisionReason: str(fd, "comment") || null, updatedAt: new Date() }).where(eq(welfareApplications.id, id));
  await db.insert(welfareApprovals).values({ applicationId: id, stage: "committee", decision: "approved", comment: str(fd, "comment") || null, userId: ctx.user.id });
  await audit(ctx.user.id, "welfare.approved", "welfare_application", id, { amountPaise: amount });
  await notify(m.userId, `Welfare application ${w.refNo} approved`, amount > 0 ? "Disbursement is being processed." : undefined, `/welfare/${id}`, "welfare");
  flash(back, "msg", "Application approved.");
}

export async function disburseWelfareAction(fd: FormData) {
  const ctx = await requirePermission("disbursements", "manage");
  const id = str(fd, "id");
  const back = `/admin/welfare?tab=applications&open=${id}`;
  const { w, m } = await loadApp(ctx, id);
  if (w.status !== "payment_pending" || w.currentStage !== "finance") flash(back, "err", "Only approved applications awaiting payment can be disbursed.");
  if (w.approvedBy === ctx.user.id && !ctx.isMainAdmin) flash(back, "err", "The approver cannot also disburse the funds. Another authorized officer must do this.");
  const amount = rupeesToPaise(fd.get("amount")) || (w.approvedPaise ?? 0);
  if (amount <= 0 || amount > (w.approvedPaise ?? 0)) flash(back, "err", "Enter a valid amount (not more than the approved amount).");
  await db.insert(welfareDisbursements).values({ applicationId: id, amountPaise: amount, method: str(fd, "method") || "bank", reference: strOrNull(fd, "reference"), disbursedBy: ctx.user.id });
  await db.update(welfareApplications).set({ status: "disbursed", currentStage: "done", updatedAt: new Date() }).where(eq(welfareApplications.id, id));
  await db.insert(welfareApprovals).values({ applicationId: id, stage: "finance", decision: "disbursed", comment: str(fd, "reference") || null, userId: ctx.user.id });
  await audit(ctx.user.id, "welfare.disbursed", "welfare_application", id, { amountPaise: amount, selfApproved: w.approvedBy === ctx.user.id });
  await notify(m.userId, `Welfare assistance disbursed (${w.refNo})`, undefined, `/welfare/${id}`, "welfare");
  flash(back, "msg", "Disbursement recorded.");
}

export async function closeWelfareAction(fd: FormData) {
  const ctx = await requirePermission("welfare", "edit");
  const id = str(fd, "id");
  await loadApp(ctx, id);
  await db.update(welfareApplications).set({ status: "closed", updatedAt: new Date() }).where(eq(welfareApplications.id, id));
  await audit(ctx.user.id, "welfare.closed", "welfare_application", id);
  flash(`/admin/welfare?tab=applications`, "msg", "Application closed.");
}

export async function saveSchemeAction(fd: FormData) {
  const ctx = await requirePermission("welfare", "manage");
  const id = str(fd, "id");
  const levels = ["mandal", "district", "welfare_officer"].filter((l) => fd.get(`lvl_${l}`) === "on");
  const vals = {
    name: str(fd, "name"),
    category: str(fd, "category") || "other",
    description: strOrNull(fd, "description"),
    maxAmountPaise: str(fd, "max") ? rupeesToPaise(fd.get("max")) : null,
    approvalLevels: levels,
    active: fd.get("active") === "on",
  };
  if (!vals.name) flash("/admin/welfare?tab=schemes", "err", "Scheme name is required.");
  if (id) await db.update(welfareSchemes).set(vals).where(eq(welfareSchemes.id, id));
  else await db.insert(welfareSchemes).values(vals);
  await audit(ctx.user.id, id ? "welfare.scheme_updated" : "welfare.scheme_created", "welfare_scheme", id || null, { name: vals.name });
  flash("/admin/welfare?tab=schemes", "msg", "Scheme saved.");
}

export async function updateEmergencyAction(fd: FormData) {
  const ctx = await requirePermission("emergency", "edit");
  const id = str(fd, "id");
  const status = str(fd, "status");
  if (!["acknowledged", "responding", "resolved", "closed"].includes(status)) flash("/admin/emergency", "err", "Invalid status.");
  const assign = str(fd, "assignSelf") === "1";
  const [e] = await db.select().from(emergencyRequests).where(eq(emergencyRequests.id, id));
  if (!e) flash("/admin/emergency", "err", "Request not found.");
  await db
    .update(emergencyRequests)
    .set({ status, responseNote: strOrNull(fd, "note"), ...(assign || !e.assignedTo ? { assignedTo: ctx.user.id } : {}), updatedAt: new Date() })
    .where(eq(emergencyRequests.id, id));
  const [m] = await db.select({ userId: members.userId }).from(members).where(eq(members.id, e.memberId));
  await notify(m?.userId, `Emergency request ${status}`, strOrNull(fd, "note") ?? undefined, "/emergency", "emergency");
  await audit(ctx.user.id, "emergency.updated", "emergency_request", id, { status });
  flash("/admin/emergency", "msg", "Emergency request updated.");
}
