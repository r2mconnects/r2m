import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { paymentTransactions } from "@/db/schema";
import { getAuth } from "@/lib/auth/session";
import { verifyCheckoutSignature } from "@/lib/payments/razorpay";
import { markTransactionPaid } from "@/lib/payments/verification";

/** Server-side verification of the Razorpay checkout signature. Payment is recorded only if it validates. */
export async function POST(req: Request) {
  const ctx = await getAuth();
  if (!ctx) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as { razorpay_order_id?: string; razorpay_payment_id?: string; razorpay_signature?: string };
  if (!b.razorpay_order_id || !b.razorpay_payment_id || !b.razorpay_signature) return NextResponse.json({ error: "Missing fields." }, { status: 400 });
  const [txn] = await db
    .select()
    .from(paymentTransactions)
    .where(and(eq(paymentTransactions.gatewayOrderId, b.razorpay_order_id), eq(paymentTransactions.userId, ctx.user.id)));
  if (!txn) return NextResponse.json({ error: "Transaction not found." }, { status: 404 });
  if (!verifyCheckoutSignature(b.razorpay_order_id, b.razorpay_payment_id, b.razorpay_signature))
    return NextResponse.json({ error: "Payment signature could not be verified." }, { status: 400 });
  await markTransactionPaid(txn.id, { gatewayPaymentId: b.razorpay_payment_id });
  return NextResponse.json({ ok: true });
}
