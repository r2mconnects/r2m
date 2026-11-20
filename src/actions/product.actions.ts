"use server";

import { count, eq } from "drizzle-orm";
import { db } from "@/db";
import { coupons, productBrands, productCategories, products, stockMovements } from "@/db/schema";
import { requirePermission } from "@/lib/auth/session";
import { audit } from "@/lib/audit";
import { fileUrl, saveUpload } from "@/lib/uploads";
import { flash, intOrNull, rupeesToPaise, slugify, str, strOrNull } from "@/lib/utils";

export async function saveProductAction(fd: FormData) {
  const id = str(fd, "id");
  const ctx = await requirePermission("shop", id ? "edit" : "create");
  const back = id ? `/admin/shop/products?edit=${id}` : "/admin/shop/products?new=1";
  const name = str(fd, "name");
  const sku = str(fd, "sku").toUpperCase();
  const mrp = rupeesToPaise(fd.get("mrp"));
  const price = rupeesToPaise(fd.get("price"));
  if (!name || !sku) flash(back, "err", "Product name and SKU are required.");
  if (price <= 0 || mrp < price) flash(back, "err", "Selling price must be greater than 0 and not above the MRP.");
  const gst = intOrNull(fd, "gstRate") ?? 18;
  if (gst < 0 || gst > 28) flash(back, "err", "GST rate must be between 0 and 28.");

  let brandId = strOrNull(fd, "brandId");
  const newBrand = str(fd, "newBrand");
  if (newBrand) {
    const [b] = await db.insert(productBrands).values({ name: newBrand }).onConflictDoUpdate({ target: productBrands.name, set: { active: true } }).returning();
    brandId = b.id;
  }

  const newImages: string[] = [];
  try {
    for (const f of fd.getAll("images")) {
      const n = await saveUpload(f, "image");
      if (n) newImages.push(fileUrl(n)!);
    }
  } catch (e) {
    flash(back, "err", (e as Error).message);
  }
  const remove = new Set(fd.getAll("removeImage").map(String));

  const vals = {
    name, sku,
    categoryId: strOrNull(fd, "categoryId"),
    brandId,
    manufacturer: strOrNull(fd, "manufacturer"),
    description: strOrNull(fd, "description"),
    mrpPaise: mrp, pricePaise: price, gstRate: gst,
    hsn: strOrNull(fd, "hsn"),
    minStock: intOrNull(fd, "minStock") ?? 5,
    unit: str(fd, "unit") || "pcs",
    specs: strOrNull(fd, "specs"),
    warranty: strOrNull(fd, "warranty"),
    weightGrams: intOrNull(fd, "weightGrams"),
    status: ["active", "draft", "archived"].includes(str(fd, "status")) ? str(fd, "status") : "active",
    featured: fd.get("featured") === "on",
  };

  try {
    if (id) {
      const [old] = await db.select().from(products).where(eq(products.id, id));
      if (!old) flash(back, "err", "Product not found.");
      const images = [...old.images.filter((i) => !remove.has(i)), ...newImages];
      await db.update(products).set({ ...vals, images }).where(eq(products.id, id));
    } else {
      const stock = Math.max(0, intOrNull(fd, "stock") ?? 0);
      const [p] = await db.insert(products).values({ ...vals, images: newImages, stock }).returning();
      if (stock > 0) await db.insert(stockMovements).values({ productId: p.id, type: "opening", qty: stock, reason: "Opening stock", source: "admin", userId: ctx.user.id });
    }
  } catch {
    flash(back, "err", "Could not save. The SKU may already exist.");
  }
  await audit(ctx.user.id, id ? "product.updated" : "product.created", "product", id || null, { sku });
  flash("/admin/shop/products", "msg", "Product saved.");
}

export async function archiveProductAction(fd: FormData) {
  const ctx = await requirePermission("shop", "delete");
  const id = str(fd, "id");
  const archived = str(fd, "restore") !== "1";
  await db.update(products).set({ status: archived ? "archived" : "active" }).where(eq(products.id, id));
  await audit(ctx.user.id, archived ? "product.archived" : "product.restored", "product", id);
  flash("/admin/shop/products", "msg", archived ? "Product archived." : "Product restored.");
}

export async function adjustStockAction(fd: FormData) {
  const ctx = await requirePermission("shop", "edit");
  const productId = str(fd, "productId");
  const type = str(fd, "type");
  let qty = parseInt(str(fd, "qty"), 10);
  const reason = str(fd, "reason");
  const back = "/admin/shop/inventory";
  if (!productId || !Number.isFinite(qty) || qty === 0) flash(back, "err", "Choose a product and enter a non-zero quantity.");
  if (!["purchase", "adjustment", "return"].includes(type)) flash(back, "err", "Invalid movement type.");
  if (reason.length < 3) flash(back, "err", "A reason is required for every stock change.");
  if (type !== "adjustment") qty = Math.abs(qty);
  await db.transaction(async (tx) => {
    const [p] = await tx.select().from(products).where(eq(products.id, productId)).for("update");
    if (!p) throw new Error("Product not found");
    if (p.stock + qty < 0) throw new Error("Stock cannot go below zero");
    await tx.update(products).set({ stock: p.stock + qty }).where(eq(products.id, productId));
    await tx.insert(stockMovements).values({ productId, type, qty, reason, source: strOrNull(fd, "source"), userId: ctx.user.id });
  }).catch((e) => flash(back, "err", (e as Error).message));
  await audit(ctx.user.id, "inventory.adjusted", "product", productId, { type, qty, reason });
  flash(back, "msg", "Stock updated.");
}

export async function saveCategoryAction(fd: FormData) {
  const id = str(fd, "id");
  const ctx = await requirePermission("shop", id ? "edit" : "create");
  const back = "/admin/shop/categories";
  const name = str(fd, "name");
  if (!name) flash(back, "err", "Category name is required.");
  const parentId = strOrNull(fd, "parentId");
  if (parentId && parentId === id) flash(back, "err", "A category cannot be its own parent.");
  const vals = { name, parentId, sortOrder: intOrNull(fd, "sortOrder") ?? 0, active: fd.get("active") === "on" || !id };
  try {
    if (id) await db.update(productCategories).set({ ...vals, active: fd.get("active") === "on" }).where(eq(productCategories.id, id));
    else await db.insert(productCategories).values({ ...vals, slug: slugify(name) });
  } catch {
    flash(back, "err", "A category with this name already exists.");
  }
  await audit(ctx.user.id, "category.saved", "product_category", id || null, { name });
  flash(back, "msg", "Category saved.");
}

export async function deleteCategoryAction(fd: FormData) {
  const ctx = await requirePermission("shop", "delete");
  const id = str(fd, "id");
  const back = "/admin/shop/categories";
  const [{ c }] = await db.select({ c: count() }).from(products).where(eq(products.categoryId, id));
  const [{ k }] = await db.select({ k: count() }).from(productCategories).where(eq(productCategories.parentId, id));
  if (c > 0 || k > 0) flash(back, "err", "This category has products or subcategories. Disable it instead.");
  await db.delete(productCategories).where(eq(productCategories.id, id));
  await audit(ctx.user.id, "category.deleted", "product_category", id);
  flash(back, "msg", "Category deleted.");
}

export async function saveBrandAction(fd: FormData) {
  await requirePermission("shop", "create");
  const name = str(fd, "name");
  if (!name) flash("/admin/shop/categories", "err", "Brand name is required.");
  await db.insert(productBrands).values({ name }).onConflictDoNothing();
  flash("/admin/shop/categories", "msg", "Brand saved.");
}

export async function saveCouponAction(fd: FormData) {
  const ctx = await requirePermission("shop", "manage");
  const back = "/admin/shop/coupons";
  const code = str(fd, "code").toUpperCase();
  const kind = str(fd, "kind") === "flat" ? "flat" : "percent";
  const value = kind === "flat" ? rupeesToPaise(fd.get("value")) : intOrNull(fd, "value") ?? 0;
  if (!code || value <= 0 || (kind === "percent" && value > 100)) flash(back, "err", "Enter a code and a valid value.");
  const exp = strOrNull(fd, "expiresAt");
  try {
    await db.insert(coupons).values({
      code, kind, value, minOrderPaise: rupeesToPaise(fd.get("minOrder")), maxDiscountPaise: str(fd, "maxDiscount") ? rupeesToPaise(fd.get("maxDiscount")) : null,
      usageLimit: intOrNull(fd, "usageLimit"), expiresAt: exp ? new Date(exp + "T23:59:59") : null,
    });
  } catch {
    flash(back, "err", "That coupon code already exists.");
  }
  await audit(ctx.user.id, "coupon.created", "coupon", null, { code });
  flash(back, "msg", "Coupon created.");
}

export async function toggleCouponAction(fd: FormData) {
  await requirePermission("shop", "manage");
  const id = str(fd, "id");
  await db.update(coupons).set({ active: str(fd, "active") === "1" }).where(eq(coupons.id, id));
  flash("/admin/shop/coupons", "msg", "Coupon updated.");
}
