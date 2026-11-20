import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { productBrands, productCategories, products } from "@/db/schema";
import { ProductCard } from "@/components/shop/ProductCard";
import { EmptyState, Flash, PageHeader } from "@/components/shared/ui";
import { requireMember } from "@/lib/auth/session";

export default async function CategoryPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ msg?: string; err?: string }> }) {
  const { slug } = await params;
  const sp = await searchParams;
  await requireMember();
  const [cat] = await db.select().from(productCategories).where(and(eq(productCategories.slug, slug), eq(productCategories.active, true)));
  if (!cat) notFound();
  const subs = await db.select().from(productCategories).where(and(eq(productCategories.parentId, cat.id), eq(productCategories.active, true))).orderBy(asc(productCategories.sortOrder));
  const ids = [cat.id, ...subs.map((s) => s.id)];
  const items = await db
    .select({ id: products.id, name: products.name, brand: productBrands.name, pricePaise: products.pricePaise, mrpPaise: products.mrpPaise, stock: products.stock, minStock: products.minStock, images: products.images })
    .from(products)
    .leftJoin(productBrands, eq(productBrands.id, products.brandId))
    .where(and(eq(products.status, "active"), inArray(products.categoryId, ids)))
    .orderBy(asc(products.name));
  return (
    <>
      <PageHeader title={cat.name} crumbs={[{ label: "Shop", href: "/shop" }, { label: cat.name }]} />
      <Flash sp={sp} />
      {subs.length > 0 && (
        <div className="mb-3 flex gap-1 overflow-x-auto pb-1">
          {subs.map((s) => <Link key={s.id} href={`/shop/categories/${s.slug}`} className="whitespace-nowrap rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-navy">{s.name}</Link>)}
        </div>
      )}
      {items.length === 0 ? <EmptyState title="No products in this category yet" /> : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-5">{items.map((p) => <ProductCard key={p.id} p={p} back={`/shop/categories/${slug}`} />)}</div>
      )}
    </>
  );
}
