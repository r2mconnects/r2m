import { eq } from "drizzle-orm";
import { db } from "@/db";
import { cartItems, coupons, products } from "@/db/schema";
import { getSettings } from "@/lib/settings";

export async function priceCart(userId: string, couponCode?: string | null, fulfilment: "delivery" | "pickup" = "delivery") {
  const lines = await db
    .select({ id: cartItems.id, productId: products.id, name: products.name, sku: products.sku, qty: cartItems.qty, unit: products.pricePaise, gstRate: products.gstRate, hsn: products.hsn, stock: products.stock, status: products.status, images: products.images })
    .from(cartItems)
    .innerJoin(products, eq(products.id, cartItems.productId))
    .where(eq(cartItems.userId, userId));
  const s = await getSettings();
  const valid = lines.filter((l) => l.status === "active");
  const subtotal = valid.reduce((a, l) => a + l.unit * l.qty, 0);
  let discount = 0;
  let couponMsg: string | null = null;
  let couponOk: string | null = null;
  if (couponCode) {
    const [c] = await db.select().from(coupons).where(eq(coupons.code, couponCode.toUpperCase()));
    if (!c || !c.active) couponMsg = "Coupon is not valid.";
    else if (c.expiresAt && c.expiresAt < new Date()) couponMsg = "Coupon has expired.";
    else if (c.usageLimit !== null && c.used >= c.usageLimit) couponMsg = "Coupon usage limit reached.";
    else if (subtotal < c.minOrderPaise) couponMsg = `Minimum order for this coupon is ₹${c.minOrderPaise / 100}.`;
    else {
      discount = c.kind === "percent" ? Math.floor((subtotal * c.value) / 100) : c.value;
      if (c.maxDiscountPaise) discount = Math.min(discount, c.maxDiscountPaise);
      discount = Math.min(discount, subtotal);
      couponOk = c.code;
    }
  }
  const delivery = fulfilment === "pickup" || subtotal === 0 ? 0 : s.freeDeliveryAbovePaise > 0 && subtotal - discount >= s.freeDeliveryAbovePaise ? 0 : s.deliveryChargePaise;
  const total = subtotal - discount + delivery;
  // Prices are GST-inclusive; GST contained in the (post-discount) goods value:
  const ratio = subtotal > 0 ? (subtotal - discount) / subtotal : 0;
  const gst = Math.round(valid.reduce((a, l) => a + (l.unit * l.qty * ratio * l.gstRate) / (100 + l.gstRate), 0));
  return { lines: valid, subtotal, discount, delivery, total, gst, couponOk, couponMsg, invalid: lines.length - valid.length };
}

