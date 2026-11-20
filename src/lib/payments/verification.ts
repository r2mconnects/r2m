import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { members, orders, paymentTransactions } from "@/db/schema";
import { applyRenewal } from "@/lib/membership/membership";
import { deductStock } from "@/lib/data/orders";
import { notify } from "@/lib/notifications/notify";
import { audit } from "@/lib/audit";

/**
 * Idempotently marks a payment transaction as paid and applies its effects.
 * Must only be called after server-side verification (gateway signature / webhook / authorized staff).
 */
export async function markTransactionPaid(
  txnId: string,
  opts: { gatewayPaymentId?: string | null; verifiedBy?: string | null },
) {
  let notifyUser: string | null = null;
  let title = "";
  let link = "/member/payments";
  const result = await db.transaction(async (tx) => {
    const [t] = await tx.select().from(paymentTransactions).where(eq(paymentTransactions.id, txnId)).for("update");
    if (!t) throw new Error("Transaction not found");
    if (t.status === "paid") return { already: true, txn: t };
    const r = await tx.execute(sql`select nextval('receipt_seq') as n`);
    const n = Number((r.rows[0] as { n: string }).n);
    const receiptNo = `RCP-${new Date().getFullYear()}-${String(n).padStart(6, "0")}`;
    const [u] = await tx
      .update(paymentTransactions)
      .set({ status: "paid", paidAt: new Date(), receiptNo, gatewayPaymentId: opts.gatewayPaymentId ?? t.gatewayPaymentId, verifiedBy: opts.verifiedBy ?? t.verifiedBy })
      .where(eq(paymentTransactions.id, txnId))
      .returning();

    if (t.kind === "renewal" && t.memberId) {
      await applyRenewal(tx, t.memberId, t.id, t.amountPaise);
      title = "Membership renewed";
    } else if (t.kind === "membership_fee") {
      title = "Membership fee received";
    } else if (t.kind === "shop_order" && t.orderId) {
      const [o] = await tx.select().from(orders).where(eq(orders.id, t.orderId)).for("update");
      if (o) {
        await tx
          .update(orders)
          .set({
            paymentStatus: "paid",
            status: ["payment_pending", "pending"].includes(o.status) ? "paid" : o.status,
            updatedAt: new Date(),
            invoiceNo: o.invoiceNo ?? `INV-${o.orderNo.replace("ORD-", "")}`,
          })
          .where(eq(orders.id, o.id));
        await deductStock(tx, o.id, opts.verifiedBy ?? null);
        notifyUser = o.userId;
        link = `/shop/orders/${o.id}`;
        title = `Payment received for order ${o.orderNo}`;
      }
    }
    if (!notifyUser && t.memberId) {
      const [m] = await tx.select({ userId: members.userId }).from(members).where(eq(members.id, t.memberId));
      notifyUser = m?.userId ?? null;
    }
    return { already: false, txn: u };
  });
  if (!result.already) {
    await notify(notifyUser, title, `Receipt ${result.txn.receiptNo}`, link, "payment");
    await audit(opts.verifiedBy ?? null, "payment.verified", "payment_transaction", txnId, { kind: result.txn.kind, amountPaise: result.txn.amountPaise, method: result.txn.method });
  }
  return result;
}
