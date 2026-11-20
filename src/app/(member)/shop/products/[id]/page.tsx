import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq, ne } from "drizzle-orm";
import { ImageOff, Truck } from "lucide-react";
import { db } from "@/db";
import { productBrands, productCategories, products } from "@/db/schema";
import { addToCartAction } from "@/actions/shop.actions";
import { ProductCard } from "@/components/shop/ProductCard";
import { Flash, PageHeader } from "@/components/shared/ui";
import { requireMember } from "@/lib/auth/session";
import { getSettings } from "@/lib/settings";
import { formatINR } from "@/lib/utils";

export default async function ProductPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ msg?: string; err?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  await requireMember();
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const [row] = await db
    .select({ p: products, brand: productBrands.name, cat: productCategories.name, slug: productCategories.slug })
    .from(products)
    .leftJoin(productBrands, eq(productBrands.id, products.brandId))
    .leftJoin(productCategories, eq(productCategories.id, products.categoryId))
    .where(and(eq(products.id, id), eq(products.status, "active")));
  if (!row) notFound();
  const { p } = row;
  const s = await getSettings();
  const related = p.categoryId
    ? await db
        .select({ id: products.id, name: products.name, brand: productBrands.name, pricePaise: products.pricePaise, mrpPaise: products.mrpPaise, stock: products.stock, minStock: products.minStock, images: products.images })
        .from(products)
        .leftJoin(productBrands, eq(productBrands.id, products.brandId))
        .where(and(eq(products.categoryId, p.categoryId), eq(products.status, "active"), ne(products.id, p.id)))
        .limit(4)
    : [];
  const off = p.mrpPaise > p.pricePaise ? Math.round(((p.mrpPaise - p.pricePaise) / p.mrpPaise) * 100) : 0;
  const out = p.stock <= 0;
  const specs = (p.specs ?? "").split("\n").map((l) => l.split(":")).filter((a) => a[0]?.trim());
  const back = `/shop/products/${id}`;
  return (
    <>
      <PageHeader title={p.name} crumbs={[{ label: "Shop", href: "/shop" }, ...(row.cat ? [{ label: row.cat, href: `/shop/categories/${row.slug}` }] : []), { label: p.name }]} />
      <Flash sp={sp} />
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <div className="card flex aspect-square items-center justify-center overflow-hidden !p-0">
            {p.images[0] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.images[0]} alt={p.name} className="h-full w-full object-contain" />
            ) : <ImageOff size={48} className="text-slate-300" />}
          </div>
          {p.images.length > 1 && (
            <div className="mt-2 flex gap-2 overflow-x-auto">
              {p.images.map((src) => (
                <a key={src} href={src} target="_blank" className="block h-16 w-16 shrink-0 overflow-hidden rounded-lg border">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt="" className="h-full w-full object-cover" />
                </a>
              ))}
            </div>
          )}
        </div>
        <div className="space-y-3">
          {row.brand && <p className="text-xs font-semibold uppercase text-slate-500">{row.brand}{p.manufacturer ? ` • ${p.manufacturer}` : ""}</p>}
          <p className="text-3xl font-extrabold">{formatINR(p.pricePaise)} {off > 0 && <><span className="text-base font-normal text-slate-400 line-through">{formatINR(p.mrpPaise)}</span> <span className="text-sm font-bold text-green-600">{off}% off</span></>}</p>
          <p className="text-xs text-slate-500">Inclusive of {p.gstRate}% GST{p.hsn ? ` • HSN ${p.hsn}` : ""} • SKU {p.sku}</p>
          <p className={`text-sm font-semibold ${out ? "text-red-600" : "text-green-600"}`}>{out ? "Out of stock" : `In stock (${p.stock} ${p.unit})`}</p>
          <form action={addToCartAction} className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="productId" value={p.id} />
            <input type="hidden" name="back" value={back} />
            <div><label className="label" htmlFor="qty">Quantity</label><input id="qty" name="qty" type="number" min={1} max={Math.max(p.stock, 1)} defaultValue={1} className="input w-24" disabled={out} /></div>
            <button disabled={out} className="btn btn-primary">Add to Cart</button>
            <button disabled={out} name="buyNow" value="1" className="btn btn-accent">Buy Now</button>
          </form>
          <p className="flex items-center gap-2 rounded-lg bg-slate-50 p-2 text-xs text-slate-600"><Truck size={16} /> {s.pickupEnabled ? "Delivery or shop pickup." : "Delivery."} Delivery charge {s.deliveryChargePaise > 0 ? formatINR(s.deliveryChargePaise) : "free"}{s.freeDeliveryAbovePaise > 0 ? `, free above ${formatINR(s.freeDeliveryAbovePaise)}` : ""}.</p>
          {p.warranty && <p className="text-sm"><b>Warranty:</b> {p.warranty}</p>}
        </div>
      </div>
      {(p.description || specs.length > 0) && (
        <section className="card mt-4 space-y-3">
          {p.description && <div><h2 className="text-sm font-bold text-navy">Description</h2><p className="whitespace-pre-wrap text-sm">{p.description}</p></div>}
          {specs.length > 0 && <div><h2 className="text-sm font-bold text-navy">Specifications</h2><table className="tbl mt-1"><tbody>{specs.map(([k, ...v]) => <tr key={k}><td className="w-1/3 font-semibold">{k}</td><td>{v.join(":")}</td></tr>)}</tbody></table></div>}
        </section>
      )}
      {related.length > 0 && (
        <section className="mt-5"><h2 className="mb-2 text-sm font-bold text-navy">Related products</h2><div className="grid grid-cols-2 gap-3 md:grid-cols-4">{related.map((r) => <ProductCard key={r.id} p={r} back={back} />)}</div></section>
      )}
      <Link href="/shop" className="link mt-4 inline-block text-sm">← Continue shopping</Link>
    </>
  );
}
