import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { orders, paymentTransactions } from "@/db/schema";
import { getAuth } from "@/lib/auth/session";
import { applicationFee, renewalFee } from "@/lib/membership/membership";
import { createGatewayOrder, razorpayConfigured } from "@/lib/payments/razorpay";
import { getSettings } from "@/lib/settings";

export async function POST(req: Request) {
  const ctx = await getAuth();
  if (!ctx) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  if (!razorpayConfigured())
    return NextResponse.json(
      { error: "Online payments are not configured yet (RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET missing). Please pay your agent or the association office." },
      { status: 503 },
    );
  const body = (await req.json().catch(() => ({}))) as { kind?: string; orderId?: string };
  const m = ctx.member;
  let amountPaise = 0;
  let orderId: string | null = null;
  let planId: string | null = null;
  let purpose = "";

  if (body.kind === "membership_fee") {
    if (!m || !["pending", "under_review"].includes(m.status)) return NextResponse.json({ error: "No application fee is due." }, { status: 400 });
    const s = await getSettings();
    if (s.paymentPolicy === "after_approval" && m.status !== "under_review")
      return NextResponse.json({ error: "Payment opens after preliminary approval of your application." }, { status: 400 });
    const fee = await applicationFee(m.id, m.planId);
    if (fee.paid || fee.amountPaise <= 0) return NextResponse.json({ error: "No application fee is due." }, { status: 400 });
    amountPaise = fee.amountPaise;
    planId = fee.plan?.id ?? null;
    purpose = "Membership joining fee";
  } else if (body.kind === "renewal") {
    if (!m || !m.membershipNo) return NextResponse.json({ error: "Renewal is available for active members only." }, { status: 400 });
    if (m.status === "suspended") return NextResponse.json({ error: "Your membership is suspended. Contact the office." }, { status: 400 });
    const fee = await renewalFee(m);
    if (fee.amountPaise <= 0) return NextResponse.json({ error: "Renewal fee is not configured." }, { status: 400 });
    amountPaise = fee.amountPaise;
    planId = fee.plan?.id ?? null;
    purpose = "Membership renewal";
  } else if (body.kind === "shop_order" && body.orderId) {
    const [o] = await db.select().from(orders).where(and(eq(orders.id, body.orderId), eq(orders.userId, ctx.user.id)));
    if (!o || o.paymentStatus !== "pending" || o.status !== "payment_pending") return NextResponse.json({ error: "This order cannot be paid." }, { status: 400 });
    amountPaise = o.totalPaise;
    orderId = o.id;
    purpose = `Shop order ${o.orderNo}`;
  } else {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const [txn] = await db
    .insert(paymentTransactions)
    .values({ kind: body.kind, memberId: m?.id ?? null, userId: ctx.user.id, orderId, amountPaise, method: "razorpay", status: "created", purpose, planId })
    .returning();
  try {
    const go = await createGatewayOrder(amountPaise, txn.id.slice(0, 8), { txn: txn.id, kind: body.kind });
    await db.update(paymentTransactions).set({ gatewayOrderId: go.id }).where(eq(paymentTransactions.id, txn.id));
    return NextResponse.json({
      keyId: process.env.RAZORPAY_KEY_ID,
      orderId: go.id,
      amount: go.amount,
      currency: go.currency,
      description: purpose,
      prefill: { name: ctx.user.fullName, contact: ctx.user.mobile ?? "", email: ctx.user.email ?? "" },
    });
  } catch (e) {
    await db.update(paymentTransactions).set({ status: "failed" }).where(eq(paymentTransactions.id, txn.id));
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
