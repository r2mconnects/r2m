import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { members, membershipCardHistory, membershipCards, membershipPlans, membershipRenewals, paymentTransactions } from "@/db/schema";
import { getSettings } from "@/lib/settings";
import { randomToken } from "@/lib/utils";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export function addMonths(d: Date, n: number) {
  const r = new Date(d);
  const day = r.getDate();
  r.setMonth(r.getMonth() + n);
  if (r.getDate() < day) r.setDate(0);
  return r;
}

export const iso = (d: Date) => d.toISOString().slice(0, 10);

export async function getPlan(planId?: string | null) {
  if (planId) {
    const [p] = await db.select().from(membershipPlans).where(eq(membershipPlans.id, planId));
    if (p) return p;
  }
  const [p] = await db.select().from(membershipPlans).where(eq(membershipPlans.active, true)).orderBy(asc(membershipPlans.createdAt)).limit(1);
  return p ?? null;
}

/** Fee payable when joining (application + joining fee). */
export async function applicationFee(memberId: string, planId?: string | null) {
  const plan = await getPlan(planId);
  const amountPaise = plan ? plan.applicationFeePaise + plan.joiningFeePaise : 0;
  const [paid] = await db
    .select({ id: paymentTransactions.id })
    .from(paymentTransactions)
    .where(and(eq(paymentTransactions.memberId, memberId), eq(paymentTransactions.kind, "membership_fee"), eq(paymentTransactions.status, "paid")))
    .limit(1);
  return { plan, amountPaise, paid: Boolean(paid) || amountPaise === 0 };
}

/** Renewal fee including any late fee after expiry. */
export async function renewalFee(m: { planId: string | null; validTill: string | null }) {
  const plan = await getPlan(m.planId);
  if (!plan) return { plan: null, amountPaise: 0, late: false };
  const today = iso(new Date());
  const late = Boolean(m.validTill && m.validTill < today);
  return { plan, amountPaise: plan.renewalFeePaise + (late ? plan.lateFeePaise : 0), late };
}

export async function formatMembershipNo(tx: Tx) {
  const s = await getSettings();
  const r = await tx.execute(sql`select nextval('membership_seq') as n`);
  const n = Number((r.rows[0] as { n: string }).n);
  return `${s.membershipPrefix}-${String(n).padStart(6, "0")}`;
}

export async function activateMember(memberId: string, approverId: string) {
  return db.transaction(async (tx) => {
    const [m] = await tx.select().from(members).where(eq(members.id, memberId)).for("update");
    if (!m) throw new Error("Member not found");
    if (m.status === "active") return m;
    const plan = await getPlan(m.planId);
    const today = new Date();
    const validTill = iso(addMonths(today, plan?.validityMonths ?? 12));
    const membershipNo = m.membershipNo ?? (await formatMembershipNo(tx));
    const [u] = await tx
      .update(members)
      .set({ status: "active", membershipNo, approvedBy: approverId, approvedAt: today, validFrom: iso(today), validTill, planId: plan?.id ?? null, rejectReason: null })
      .where(eq(members.id, memberId))
      .returning();
    await tx
      .insert(membershipCards)
      .values({ memberId, token: randomToken(20) })
      .onConflictDoNothing();
    await tx.insert(membershipCardHistory).values({ memberId, action: "issued", userId: approverId, note: membershipNo });
    await tx.insert(membershipRenewals).values({ memberId, planId: plan?.id, kind: "joining", fromDate: iso(today), toDate: validTill, amountPaise: plan ? plan.joiningFeePaise + plan.applicationFeePaise : 0 });
    return u;
  });
}

/** Extend validity after a verified renewal payment. */
export async function applyRenewal(tx: Tx, memberId: string, transactionId: string, amountPaise: number) {
  const [m] = await tx.select().from(members).where(eq(members.id, memberId)).for("update");
  if (!m) return;
  const plan = await getPlan(m.planId);
  const today = new Date();
  const grace = plan?.graceDays ?? 0;
  const currentEnd = m.validTill ? new Date(m.validTill + "T00:00:00") : null;
  const graceLimit = currentEnd ? new Date(currentEnd.getTime() + grace * 86400000) : null;
  const from = currentEnd && graceLimit && graceLimit >= today ? (currentEnd > today ? currentEnd : today) : today;
  const to = iso(addMonths(from, plan?.validityMonths ?? 12));
  await tx.insert(membershipRenewals).values({ memberId, planId: plan?.id, transactionId, kind: "renewal", fromDate: iso(from), toDate: to, amountPaise });
  await tx
    .update(members)
    .set({ validTill: to, status: m.status === "suspended" ? "suspended" : "active" })
    .where(eq(members.id, memberId));
  await tx.insert(membershipCardHistory).values({ memberId, action: "renewed", note: `Valid till ${to}` });
}

/** Marks members whose validity ended as expired. */
export async function syncExpiry() {
  await db.execute(sql`update members set status = 'expired' where status = 'active' and valid_till < current_date`);
}
