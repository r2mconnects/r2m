"use server";

import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  cartItems, coupons, districts, mandals, orderItems, orders, paymentTransactions, productReturns, products, refunds, type OrderAddress,
} from "@/db/schema";
import { requireMember, requirePermission, requireUser } from "@/lib/auth/session";
import { audit } from "@/lib/audit";
import { restoreStock } from "@/lib/data/orders";
import { notify } from "@/lib/notifications/notify";
import { markTransactionPaid } from "@/lib/payments/verification";
import { refundGatewayPayment, razorpayConfigured } from "@/lib/payments/razorpay";
import { priceCart } from "@/lib/data/shop";
import { getSettings } from "@/lib/settings";
import { flash, rupeesToPaise, str, strOrNull } from "@/lib/utils";
import { ORDER_STATUSES } from "@/constants/status";

/* ───────── cart ───────── */
export async function addToCartAction(fd: FormData) {
  const ctx = await requireUser();
  const productId = str(fd, "productId");
  const qty = Math.max(1, Math.min(99, parseInt(str(fd, "qty") || "1", 10) || 1));
  const back = str(fd, "back") || "/shop";
  const [p] = await db.select().from(products).where(and(eq(products.id, productId), eq(products.status, "active")));
  if (!p) flash(back, "err", "Product not available.");
  if (p.stock <= 0) flash(back, "err", "This product is out of stock.");
  const [existing] = await db.select().from(cartItems).where(and(eq(cartItems.userId, ctx.user.id), eq(cartItems.productId, productId)));
  const newQty = Math.min((existing?.qty ?? 0) + qty, p.stock);
  await db
    .insert(cartItems)
    .values({ userId: ctx.user.id, productId, qty: newQty })
    .onConflictDoUpdate({ target: [cartItems.userId, cartItems.productId], set: { qty: newQty } });
  if (str(fd, "buyNow") === "1") flash("/shop/cart", "msg", "Added to cart. Review and checkout.");
  flash(back, "msg", `${p.name} added to cart.`);
}

export async function updateCartAction(fd: FormData) {
  const ctx = await requireUser();
  const id = str(fd, "id");
  const qty = parseInt(str(fd, "qty"), 10);
  if (str(fd, "remove") === "1" || !(qty > 0)) {
    await db.delete(cartItems).where(and(eq(cartItems.id, id), eq(cartItems.userId, ctx.user.id)));
    flash("/shop/cart", "msg", "Item removed.");
  }
  const [row] = await db
    .select({ stock: products.stock })
    .from(cartItems)
    .innerJoin(products, eq(products.id, cartItems.productId))
    .where(and(eq(cartItems.id, id), eq(cartItems.userId, ctx.user.id)));
  if (!row) flash("/shop/cart", "err", "Item not found.");
  await db.update(cartItems).set({ qty: Math.min(qty, Math.max(row.stock, 1)) }).where(and(eq(cartItems.id, id), eq(cartItems.userId, ctx.user.id)));
  flash("/shop/cart", "msg", "Cart updated.");
}

/* ───────── pricing (shared by cart view and checkout; always server-calculated) ───────── */
export async function applyCouponAction(fd: FormData) {
  await requireUser();
  const code = str(fd, "coupon").toUpperCase();
  flash(`/shop/cart${code ? `?coupon=${encodeURIComponent(code)}` : ""}`, "msg", code ? "Coupon checked." : "Coupon removed.");
}

/* ───────── checkout ───────── */
export async function checkoutAction(fd: FormData) {
  const ctx = await requireMember();
  const back = "/shop/checkout";
  const name = str(fd, "name");
  const mobile = str(fd, "mobile");
  const fulfilment = str(fd, "fulfilment") === "pickup" ? "pickup" : "delivery";
  const method = str(fd, "paymentMethod");
  const key = str(fd, "checkoutKey");
  const s = await getSettings();
  if (!key) flash(back, "err", "Invalid checkout session.");

  // Idempotency: the same checkout form cannot create two orders.
  const [dupe] = await db.select().from(orders).where(eq(orders.checkoutKey, key));
  if (dupe) flash(`/shop/orders/${dupe.id}`, "msg", "Order already placed.");

  if (!name || !/^[6-9]\d{9}$/.test(mobile)) flash(back, "err", "Enter your name and a valid mobile number.");
  if (fulfilment === "pickup" && !s.pickupEnabled) flash(back, "err", "Shop pickup is not available.");
  const addressText = str(fd, "address");
  const pin = str(fd, "pin");
  if (fulfilment === "delivery" && (addressText.length < 5 || !/^\d{6}$/.test(pin))) flash(back, "err", "Enter the delivery address and a 6-digit PIN code.");
  if (method === "cod" && !s.codEnabled) flash(back, "err", "Cash on delivery is not enabled.");
  if (!["online", "cod"].includes(method)) flash(back, "err", "Choose a payment method.");

  const couponCode = strOrNull(fd, "coupon");
  const priced = await priceCart(ctx.user.id, couponCode, fulfilment);
  if (priced.lines.length === 0) flash("/shop/cart", "err", "Your cart is empty.");
  if (priced.invalid) flash("/shop/cart", "err", "Some items are no longer available. Please review your cart.");
  for (const l of priced.lines) if (l.stock < l.qty) flash("/shop/cart", "err", `Only ${l.stock} of "${l.name}" in stock.`);
  if (couponCode && !priced.couponOk) flash("/shop/cart", "err", priced.couponMsg ?? "Coupon invalid.");

  const [d] = str(fd, "districtId") ? await db.select().from(districts).where(eq(districts.id, str(fd, "districtId"))) : [];
  const [m] = str(fd, "mandalId") ? await db.select().from(mandals).where(eq(mandals.id, str(fd, "mandalId"))) : [];
  const address: OrderAddress = {
    name, mobile, address: addressText, district: d?.name, mandal: m?.name, village: str(fd, "village") || undefined, pin: pin || undefined, instructions: str(fd, "instructions") || undefined,
  };

  const orderId = await db.transaction(async (tx) => {
    const r = await tx.execute(sql`select nextval('order_seq') as n`);
    const orderNo = `ORD-${(r.rows[0] as { n: string }).n}`;
    const [o] = await tx
      .insert(orders)
      .values({
        orderNo, userId: ctx.user.id, memberId: ctx.member.id, status: method === "cod" ? "confirmed" : "payment_pending", paymentMethod: method, paymentStatus: "pending", fulfilment,
        subtotalPaise: priced.subtotal, discountPaise: priced.discount, deliveryPaise: priced.delivery, totalPaise: priced.total, gstPaise: priced.gst,
        couponCode: priced.couponOk, address, checkoutKey: key, invoiceNo: `INV-${orderNo.replace("ORD-", "")}`,
      })
      .returning();
    await tx.insert(orderItems).values(priced.lines.map((l) => ({ orderId: o.id, productId: l.productId, name: l.name, sku: l.sku, qty: l.qty, unitPaise: l.unit, gstRate: l.gstRate, hsn: l.hsn })));
    if (priced.couponOk) await tx.update(coupons).set({ used: sql`${coupons.used} + 1` }).where(eq(coupons.code, priced.couponOk));
    await tx.delete(cartItems).where(eq(cartItems.userId, ctx.user.id));
    if (method === "cod") {
      // COD reserves stock immediately.
      const { deductStock } = await import("@/lib/data/orders");
      await deductStock(tx, o.id, ctx.user.id);
    }
    return o.id;
  });
  await audit(ctx.user.id, "order.placed", "order", orderId);
  await notify(ctx.user.id, "Order placed", method === "cod" ? "Pay on delivery." : "Complete the payment to confirm your order.", `/shop/orders/${orderId}`, "order");
  flash(`/shop/orders/${orderId}`, "msg", "Order placed.");
}

/* ───────── member order actions ───────── */
export async function cancelOrderAction(fd: FormData) {
  const ctx = await requireUser();
  const id = str(fd, "id");
  const back = `/shop/orders/${id}`;
  const [o] = await db.select().from(orders).where(and(eq(orders.id, id), eq(orders.userId, ctx.user.id)));
  if (!o) flash("/shop/orders", "err", "Order not found.");
  if (!["pending", "payment_pending", "paid", "confirmed"].includes(o.status)) flash(back, "err", "This order can no longer be cancelled. Request a return instead.");
  await db.transaction(async (tx) => {
    await restoreStock(tx, id, ctx.user.id, "cancel");
    await tx.update(orders).set({ status: "cancelled", cancelReason: str(fd, "reason") || "Cancelled by member", updatedAt: new Date() }).where(eq(orders.id, id));
  });
  await audit(ctx.user.id, "order.cancelled", "order", id);
  flash(back, "msg", o.paymentStatus === "paid" ? "Order cancelled. A refund will be processed by the association." : "Order cancelled.");
}

export async function requestReturnAction(fd: FormData) {
  const ctx = await requireUser();
  const id = str(fd, "id");
  const back = `/shop/orders/${id}`;
  const [o] = await db.select().from(orders).where(and(eq(orders.id, id), eq(orders.userId, ctx.user.id)));
  if (!o || o.status !== "delivered") flash(back, "err", "Returns can be requested only for delivered orders.");
  const reason = str(fd, "reason");
  if (reason.length < 3) flash(back, "err", "Please give a reason.");
  await db.insert(productReturns).values({ orderId: id, reason });
  await db.update(orders).set({ status: "return_requested", updatedAt: new Date() }).where(eq(orders.id, id));
  flash(back, "msg", "Return requested. The association will contact you.");
}

/* ───────── admin order management ───────── */
export async function updateOrderStatusAction(fd: FormData) {
  const ctx = await requirePermission("orders", "edit");
  const id = str(fd, "id");
  const status = str(fd, "status");
  const back = `/admin/shop/orders?open=${id}`;
  if (!(ORDER_STATUSES as readonly string[]).includes(status)) flash(back, "err", "Invalid status.");
  const [o] = await db.select().from(orders).where(eq(orders.id, id));
  if (!o) flash(back, "err", "Order not found.");
  if (["confirmed", "processing", "packed", "shipped", "out_for_delivery", "delivered"].includes(status) && o.paymentStatus !== "paid" && o.paymentMethod !== "cod")
    flash(back, "err", "Payment has not been verified for this order.");
  await db.transaction(async (tx) => {
    if (status === "cancelled" || status === "returned") await restoreStock(tx, id, ctx.user.id, status === "cancelled" ? "cancel" : "return");
    await tx.update(orders).set({ status, updatedAt: new Date(), ...(status === "delivered" && o.paymentMethod === "cod" ? { paymentStatus: "paid" } : {}) }).where(eq(orders.id, id));
    if (status === "delivered" && o.paymentMethod === "cod") {
      const [t] = await tx.select().from(paymentTransactions).where(and(eq(paymentTransactions.orderId, id), eq(paymentTransactions.method, "cod")));
      if (!t) await tx.insert(paymentTransactions).values({ kind: "shop_order", userId: o.userId, memberId: o.memberId, orderId: id, amountPaise: o.totalPaise, method: "cod", status: "created", purpose: `Shop order ${o.orderNo}`, collectedBy: ctx.user.id });
    }
  });
  if (status === "delivered" && o.paymentMethod === "cod") {
    const [t] = await db.select().from(paymentTransactions).where(and(eq(paymentTransactions.orderId, id), eq(paymentTransactions.method, "cod")));
    if (t) await markTransactionPaid(t.id, { verifiedBy: ctx.user.id });
  }
  await audit(ctx.user.id, "order.status", "order", id, { status });
  await notify(o.userId, `Order ${o.orderNo}: ${status.replace(/_/g, " ")}`, undefined, `/shop/orders/${id}`, "order");
  flash(back, "msg", "Order updated.");
}

/** Authorized staff records an offline payment (cash/UPI/bank) for an unpaid online order. */
export async function recordOrderPaymentAction(fd: FormData) {
  const ctx = await requirePermission("orders", "manage");
  const id = str(fd, "id");
  const back = `/admin/shop/orders?open=${id}`;
  const [o] = await db.select().from(orders).where(eq(orders.id, id));
  if (!o || o.paymentStatus !== "pending" || o.status === "cancelled") flash(back, "err", "Order is not awaiting payment.");
  const ref = str(fd, "reference");
  if (!ref) flash(back, "err", "Enter a payment reference for the audit trail.");
  const [t] = await db
    .insert(paymentTransactions)
    .values({ kind: "shop_order", userId: o.userId, memberId: o.memberId, orderId: id, amountPaise: o.totalPaise, method: str(fd, "method") || "cash", status: "created", purpose: `Shop order ${o.orderNo} (${ref})`, collectedBy: ctx.user.id })
    .returning();
  await markTransactionPaid(t.id, { verifiedBy: ctx.user.id });
  flash(back, "msg", "Payment recorded and stock deducted.");
}

export async function processRefundAction(fd: FormData) {
  const ctx = await requirePermission("orders", "manage");
  const id = str(fd, "id");
  const back = `/admin/shop/orders?open=${id}`;
  const [o] = await db.select().from(orders).where(eq(orders.id, id));
  if (!o || o.paymentStatus !== "paid") flash(back, "err", "Only paid orders can be refunded.");
  if (!["cancelled", "returned", "return_requested"].includes(o.status)) flash(back, "err", "Cancel or return the order before refunding.");
  const amount = str(fd, "amount") ? rupeesToPaise(fd.get("amount")) : o.totalPaise;
  if (amount <= 0 || amount > o.totalPaise) flash(back, "err", "Invalid refund amount.");
  const [t] = await db.select().from(paymentTransactions).where(and(eq(paymentTransactions.orderId, id), eq(paymentTransactions.status, "paid")));
  let gatewayRefundId: string | null = null;
  let method = "manual";
  if (t?.method === "razorpay" && t.gatewayPaymentId && razorpayConfigured() && str(fd, "viaGateway") === "1") {
    try {
      gatewayRefundId = (await refundGatewayPayment(t.gatewayPaymentId, amount)).id;
      method = "razorpay";
    } catch (e) {
      flash(back, "err", (e as Error).message);
    }
  }
  await db.insert(refunds).values({ transactionId: t?.id, orderId: id, amountPaise: amount, reason: str(fd, "reason") || o.cancelReason, method, reference: strOrNull(fd, "reference"), gatewayRefundId, processedBy: ctx.user.id });
  await db.update(orders).set({ status: "refunded", paymentStatus: "refunded", updatedAt: new Date() }).where(eq(orders.id, id));
  if (t) await db.update(paymentTransactions).set({ status: "refunded" }).where(eq(paymentTransactions.id, t.id));
  await db.update(productReturns).set({ status: "received" }).where(eq(productReturns.orderId, id));
  await audit(ctx.user.id, "order.refunded", "order", id, { amountPaise: amount, method });
  await notify(o.userId, `Refund processed for ${o.orderNo}`, undefined, `/shop/orders/${id}`, "refund");
  flash(back, "msg", "Refund recorded.");
}

