import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { paymentTransactions } from "@/db/schema";
import { verifyWebhookSignature } from "@/lib/payments/razorpay";
import { markTransactionPaid } from "@/lib/payments/verification";

export async function POST(req: Request) {
  const raw = await req.text();
  const sig = req.headers.get("x-razorpay-signature") ?? "";
  if (!process.env.RAZORPAY_WEBHOOK_SECRET) return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
  if (!verifyWebhookSignature(raw, sig)) return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  const evt = JSON.parse(raw) as {
    event: string;
    payload?: { payment?: { entity?: { id: string; order_id: string } } };
  };
  const p = evt.payload?.payment?.entity;
  if (p?.order_id) {
    const [txn] = await db.select().from(paymentTransactions).where(eq(paymentTransactions.gatewayOrderId, p.order_id));
    if (txn) {
      if (evt.event === "payment.captured" || evt.event === "order.paid") await markTransactionPaid(txn.id, { gatewayPaymentId: p.id });
      else if (evt.event === "payment.failed")
        await db.update(paymentTransactions).set({ status: "failed" }).where(and(eq(paymentTransactions.id, txn.id), eq(paymentTransactions.status, "created")));
    }
  }
  return NextResponse.json({ ok: true });
}
