import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { orderItems, orders, products, stockMovements } from "@/db/schema";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Deduct stock exactly once per order (guarded by orders.stock_deducted). */
export async function deductStock(tx: Tx, orderId: string, userId: string | null) {
  const [o] = await tx.select().from(orders).where(eq(orders.id, orderId)).for("update");
  if (!o || o.stockDeducted) return;
  const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, orderId));
  for (const it of items) {
    if (!it.productId) continue;
    await tx
      .update(products)
      .set({ stock: sql`${products.stock} - ${it.qty}`, soldCount: sql`${products.soldCount} + ${it.qty}` })
      .where(eq(products.id, it.productId));
    await tx.insert(stockMovements).values({
      productId: it.productId, type: "sale", qty: -it.qty, reason: `Order ${o.orderNo}`, source: "shop", refId: orderId, userId,
    });
  }
  await tx.update(orders).set({ stockDeducted: true }).where(eq(orders.id, orderId));
}

/** Return stock to inventory when a deducted order is cancelled or returned. */
export async function restoreStock(tx: Tx, orderId: string, userId: string | null, type: "cancel" | "return") {
  const [o] = await tx.select().from(orders).where(eq(orders.id, orderId)).for("update");
  if (!o || !o.stockDeducted) return;
  const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, orderId));
  for (const it of items) {
    if (!it.productId) continue;
    await tx
      .update(products)
      .set({ stock: sql`${products.stock} + ${it.qty}`, soldCount: sql`greatest(${products.soldCount} - ${it.qty}, 0)` })
      .where(eq(products.id, it.productId));
    await tx.insert(stockMovements).values({
      productId: it.productId, type, qty: it.qty, reason: `${type === "cancel" ? "Cancelled" : "Returned"} order ${o.orderNo}`, source: "shop", refId: orderId, userId,
    });
  }
  await tx.update(orders).set({ stockDeducted: false }).where(eq(orders.id, orderId));
}
