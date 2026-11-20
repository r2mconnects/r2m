import { asc, count, eq } from "drizzle-orm";
import { db } from "@/db";
import { productBrands, productCategories, products } from "@/db/schema";
import { deleteCategoryAction, saveBrandAction, saveCategoryAction } from "@/actions/product.actions";
import { SubmitButton } from "@/components/forms/controls";
import { Flash, PageHeader } from "@/components/shared/ui";
import { can, requirePermission } from "@/lib/auth/session";

export const metadata = { title: "Categories" };

export default async function CategoriesAdmin({ searchParams }: { searchParams: Promise<{ msg?: string; err?: string }> }) {
  const sp = await searchParams;
  const ctx = await requirePermission("shop", "view");
  const cats = await db.select().from(productCategories).orderBy(asc(productCategories.sortOrder), asc(productCategories.name));
  const brands = await db.select().from(productBrands).orderBy(asc(productBrands.name));
  const counts = await db.select({ id: products.categoryId, n: count() }).from(products).groupBy(products.categoryId);
  const roots = cats.filter((c) => !c.parentId);
  const edit = can(ctx, "shop", "edit");
  const Row = ({ c, depth }: { c: typeof cats[number]; depth: number }) => (
    <form action={saveCategoryAction} className="flex flex-wrap items-center gap-2 border-b px-3 py-2 last:border-0" style={{ paddingLeft: 12 + depth * 24 }}>
      <input type="hidden" name="id" value={c.id} />
      <input name="name" defaultValue={c.name} disabled={!edit} className="input max-w-64" aria-label="Name" />
      <select name="parentId" defaultValue={c.parentId ?? ""} disabled={!edit} className="input max-w-48" aria-label="Parent"><option value="">Top level</option>{roots.filter((r) => r.id !== c.id).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select>
      <input name="sortOrder" type="number" defaultValue={c.sortOrder} disabled={!edit} className="input w-20" aria-label="Order" />
      <label className="flex items-center gap-1 text-xs"><input type="checkbox" name="active" defaultChecked={c.active} disabled={!edit} /> Active</label>
      <span className="text-xs text-slate-400">{counts.find((x) => x.id === c.id)?.n ?? 0} products</span>
      {edit && <SubmitButton className="btn-outline btn-sm">Save</SubmitButton>}
      {can(ctx, "shop", "delete") && <button formAction={deleteCategoryAction} className="btn btn-danger btn-sm" type="submit">Delete</button>}
    </form>
  );
  return (
    <>
      <PageHeader title="Product Categories & Brands" crumbs={[{ label: "Shop" }, { label: "Categories" }]} />
      <Flash sp={sp} />
      {can(ctx, "shop", "create") && (
        <div className="mb-4 grid gap-3 md:grid-cols-2">
          <form action={saveCategoryAction} className="card flex flex-wrap items-end gap-2"><div><label className="label" htmlFor="cn">New category</label><input id="cn" name="name" required className="input" /></div>
            <div><label className="label" htmlFor="cp">Parent</label><select id="cp" name="parentId" className="input"><option value="">Top level</option>{roots.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></div><SubmitButton>Add</SubmitButton></form>
          <form action={saveBrandAction} className="card flex items-end gap-2"><div><label className="label" htmlFor="bn">New brand</label><input id="bn" name="name" required className="input" /></div><SubmitButton>Add brand</SubmitButton></form>
        </div>
      )}
      <div className="card !p-0">{roots.map((r) => (<div key={r.id}><Row c={r} depth={0} />{cats.filter((c) => c.parentId === r.id).map((c) => <Row key={c.id} c={c} depth={1} />)}</div>))}</div>
      <section className="card mt-4"><h2 className="mb-1 text-sm font-bold text-navy">Brands</h2><p className="text-sm text-slate-600">{brands.length ? brands.map((b) => b.name).join(" • ") : "No brands yet."}</p></section>
      <span className="hidden">{String(eq)}</span>
    </>
  );
}
