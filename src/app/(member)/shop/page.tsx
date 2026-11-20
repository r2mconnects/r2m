import Link from "next/link";
import { and, asc, desc, eq, gt, ilike, isNull, or, sql } from "drizzle-orm";
import { Package, Search } from "lucide-react";
import { db } from "@/db";
import { productBrands, productCategories, products } from "@/db/schema";
import { ProductCard } from "@/components/shop/ProductCard";
import { EmptyState, Flash, PageHeader } from "@/components/shared/ui";
import { requireMember } from "@/lib/auth/session";
import { rupeesToPaise } from "@/lib/utils";

export const metadata = { title: "Shop" };

const cols = {
  id: products.id, name: products.name, brand: productBrands.name, pricePaise: products.pricePaise, mrpPaise: products.mrpPaise,
  stock: products.stock, minStock: products.minStock, images: products.images,
};

export default async function ShopPage({ searchParams }: { searchParams: Promise<{ q?: string; brand?: string; min?: string; max?: string; avail?: string; sort?: string; msg?: string; err?: string }> }) {
  const sp = await searchParams;
  await requireMember();
  const cats = await db.select().from(productCategories).where(and(eq(productCategories.active, true), isNull(productCategories.parentId))).orderBy(asc(productCategories.sortOrder));
  const brands = await db.select().from(productBrands).where(eq(productBrands.active, true)).orderBy(asc(productBrands.name));
  const base = eq(products.status, "active");
  const searching = Boolean(sp.q || sp.brand || sp.min || sp.max || sp.avail || sp.sort);

  const q = db.select(cols).from(products).leftJoin(productBrands, eq(productBrands.id, products.brandId));
  if (searching) {
    const conds = [base];
    if (sp.q) {
      const like = `%${sp.q}%`;
      conds.push(or(ilike(products.name, like), ilike(products.sku, like), ilike(productBrands.name, like), sql`${products.categoryId} in (select id from product_categories where name ilike ${like})`)!);
    }
    if (sp.brand) conds.push(eq(products.brandId, sp.brand));
    if (sp.min) conds.push(sql`${products.pricePaise} >= ${rupeesToPaise(sp.min)}`);
    if (sp.max) conds.push(sql`${products.pricePaise} <= ${rupeesToPaise(sp.max)}`);
    if (sp.avail === "1") conds.push(gt(products.stock, 0));
    const order = sp.sort === "price_asc" ? asc(products.pricePaise) : sp.sort === "price_desc" ? desc(products.pricePaise) : sp.sort === "popular" ? desc(products.soldCount) : desc(products.createdAt);
    const results = await q.where(and(...conds)).orderBy(order).limit(60);
    return (
      <>
        <Header sp={sp} cats={cats} brands={brands} />
        <PageHeader title={`Search results (${results.length})`} />
        {results.length === 0 ? <EmptyState title="No products match" hint="Try different keywords or filters." /> : <Grid items={results} back="/shop" />}
      </>
    );
  }
  const [featured, fresh, best] = await Promise.all([
    db.select(cols).from(products).leftJoin(productBrands, eq(productBrands.id, products.brandId)).where(and(base, eq(products.featured, true))).limit(8),
    db.select(cols).from(products).leftJoin(productBrands, eq(productBrands.id, products.brandId)).where(base).orderBy(desc(products.createdAt)).limit(8),
    db.select(cols).from(products).leftJoin(productBrands, eq(productBrands.id, products.brandId)).where(and(base, gt(products.soldCount, 0))).orderBy(desc(products.soldCount)).limit(8),
  ]);
  return (
    <>
      <Header sp={sp} cats={cats} brands={brands} />
      <section className="mb-5">
        <h2 className="mb-2 text-sm font-bold text-navy">Categories</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
          {cats.map((c) => (
            <Link key={c.id} href={`/shop/categories/${c.slug}`} className="card flex flex-col items-center gap-1 !p-3 text-center hover:border-royal">
              <Package className="text-royal" size={22} />
              <span className="text-[11px] font-semibold leading-tight text-navy">{c.name}</span>
            </Link>
          ))}
        </div>
      </section>
      {fresh.length === 0 && <EmptyState title="The shop is being stocked" hint="Products added by the association will appear here." />}
      {featured.length > 0 && <Section title="Featured products" items={featured} />}
      {best.length > 0 && <Section title="Best sellers" items={best} />}
      {fresh.length > 0 && <Section title="New arrivals" items={fresh} />}
    </>
  );
}

type Item = { id: string; name: string; brand: string | null; pricePaise: number; mrpPaise: number; stock: number; minStock: number; images: string[] };

function Grid({ items, back }: { items: Item[]; back: string }) {
  return <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-5">{items.map((p) => <ProductCard key={p.id} p={p} back={back} />)}</div>;
}
function Section({ title, items }: { title: string; items: Item[] }) {
  return <section className="mb-5"><h2 className="mb-2 text-sm font-bold text-navy">{title}</h2><Grid items={items} back="/shop" /></section>;
}

function Header({ sp, cats, brands }: { sp: Record<string, string | undefined>; cats: Array<{ id: string; name: string; slug: string }>; brands: Array<{ id: string; name: string }> }) {
  void cats;
  return (
    <>
      <Flash sp={sp} />
      <div className="mb-3 flex items-center gap-2">
        <h1 className="h-title flex-1">Shop</h1>
        <Link href="/shop/orders" className="btn btn-outline btn-sm">My Orders</Link>
        <Link href="/shop/cart" className="btn btn-primary btn-sm">Cart</Link>
      </div>
      <form className="card mb-4 grid gap-2 !p-3 sm:grid-cols-6">
        <div className="relative sm:col-span-2"><Search size={16} className="absolute left-3 top-3 text-slate-400" /><input name="q" defaultValue={sp.q} placeholder="Search name, code, brand, category" className="input pl-9" aria-label="Search products" /></div>
        <select name="brand" defaultValue={sp.brand ?? ""} className="input" aria-label="Brand"><option value="">All brands</option>{brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
        <div className="flex gap-1"><input name="min" defaultValue={sp.min} placeholder="Min ₹" className="input" inputMode="numeric" /><input name="max" defaultValue={sp.max} placeholder="Max ₹" className="input" inputMode="numeric" /></div>
        <select name="sort" defaultValue={sp.sort ?? ""} className="input" aria-label="Sort"><option value="">Newest</option><option value="popular">Popularity</option><option value="price_asc">Price: low to high</option><option value="price_desc">Price: high to low</option></select>
        <div className="flex items-center gap-2"><label className="flex items-center gap-1 text-xs"><input type="checkbox" name="avail" value="1" defaultChecked={sp.avail === "1"} /> In stock</label><button className="btn btn-primary btn-sm">Apply</button></div>
      </form>
    </>
  );
}
