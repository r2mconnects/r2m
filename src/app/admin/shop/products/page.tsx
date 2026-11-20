import Link from "next/link";
import { asc, desc, eq, ilike, or, and } from "drizzle-orm";
import { ImageOff } from "lucide-react";
import { db } from "@/db";
import { productBrands, productCategories, products } from "@/db/schema";
import { archiveProductAction, saveProductAction } from "@/actions/product.actions";
import { Checkbox, Field } from "@/components/forms/Field";
import { SubmitButton } from "@/components/forms/controls";
import { EmptyState, Flash, PageHeader, StatusBadge } from "@/components/shared/ui";
import { can, requirePermission } from "@/lib/auth/session";
import { formatINR } from "@/lib/utils";

export const metadata = { title: "Products" };

export default async function ProductsAdmin({ searchParams }: { searchParams: Promise<{ new?: string; edit?: string; q?: string; cat?: string; msg?: string; err?: string }> }) {
  const sp = await searchParams;
  const ctx = await requirePermission("shop", "view");
  const cats = await db.select().from(productCategories).orderBy(asc(productCategories.name));
  const brands = await db.select().from(productBrands).orderBy(asc(productBrands.name));
  const conds = [];
  if (sp.q) conds.push(or(ilike(products.name, `%${sp.q}%`), ilike(products.sku, `%${sp.q}%`)));
  if (sp.cat) conds.push(eq(products.categoryId, sp.cat));
  const list = await db
    .select({ p: products, cat: productCategories.name, brand: productBrands.name })
    .from(products)
    .leftJoin(productCategories, eq(productCategories.id, products.categoryId))
    .leftJoin(productBrands, eq(productBrands.id, products.brandId))
    .where(and(...conds))
    .orderBy(desc(products.createdAt))
    .limit(200);
  const editing = sp.edit ? list.find((x) => x.p.id === sp.edit)?.p : undefined;
  const showForm = (sp.new && can(ctx, "shop", "create")) || (editing && can(ctx, "shop", "edit"));
  const catName = new Map(cats.map((c) => [c.id, c]));
  const catOpts = cats.map((c) => ({ value: c.id, label: c.parentId ? `${catName.get(c.parentId)?.name} › ${c.name}` : c.name }));
  return (
    <>
      <PageHeader title="Product Management" crumbs={[{ label: "Shop" }, { label: "Products" }]} actions={can(ctx, "shop", "create") ? <Link href="/admin/shop/products?new=1" className="btn btn-primary btn-sm">+ Add Product</Link> : undefined} />
      <Flash sp={sp} />
      {showForm && (
        <form action={saveProductAction} className="card mb-4 grid gap-3 sm:grid-cols-3">
          {editing && <input type="hidden" name="id" value={editing.id} />}
          <h2 className="text-sm font-bold text-navy sm:col-span-3">{editing ? `Edit ${editing.name}` : "New product"}</h2>
          <Field label="Product name" name="name" required defaultValue={editing?.name} className="sm:col-span-2" />
          <Field label="SKU / product code" name="sku" required defaultValue={editing?.sku} />
          <Field label="Category / subcategory" name="categoryId" options={catOpts} defaultValue={editing?.categoryId} />
          <Field label="Brand" name="brandId" options={brands.map((b) => ({ value: b.id, label: b.name }))} defaultValue={editing?.brandId} />
          <Field label="…or new brand" name="newBrand" />
          <Field label="Manufacturer" name="manufacturer" defaultValue={editing?.manufacturer} />
          <Field label="MRP (₹)" name="mrp" type="number" min={1} step="0.01" required defaultValue={editing ? editing.mrpPaise / 100 : undefined} />
          <Field label="Selling price (₹, GST-inclusive)" name="price" type="number" min={1} step="0.01" required defaultValue={editing ? editing.pricePaise / 100 : undefined} />
          <Field label="GST rate (%)" name="gstRate" type="number" min={0} defaultValue={editing?.gstRate ?? 18} />
          <Field label="HSN code" name="hsn" defaultValue={editing?.hsn} />
          {!editing && <Field label="Opening stock" name="stock" type="number" min={0} defaultValue={0} />}
          <Field label="Minimum stock alert" name="minStock" type="number" min={0} defaultValue={editing?.minStock ?? 5} />
          <Field label="Unit" name="unit" defaultValue={editing?.unit ?? "pcs"} />
          <Field label="Warranty" name="warranty" defaultValue={editing?.warranty} />
          <Field label="Shipping weight (g)" name="weightGrams" type="number" min={0} defaultValue={editing?.weightGrams} />
          <Field label="Status" name="status" required defaultValue={editing?.status ?? "active"} options={[{ value: "active", label: "Active" }, { value: "draft", label: "Draft" }, { value: "archived", label: "Archived" }]} />
          <Field label="Description" name="description" rows={3} defaultValue={editing?.description} className="sm:col-span-3" />
          <Field label="Specifications (one per line, “Key: value”)" name="specs" rows={3} defaultValue={editing?.specs} className="sm:col-span-3" />
          <Field label="Add images (multiple)" name="images" type="file" multiple accept="image/*" className="sm:col-span-2" />
          <Checkbox name="featured" label="Featured product" defaultChecked={editing?.featured} />
          {editing && editing.images.length > 0 && <div className="flex flex-wrap gap-3 sm:col-span-3">{editing.images.map((src) => <label key={src} className="text-xs"><span className="block h-16 w-16 overflow-hidden rounded border">{/* eslint-disable-next-line @next/next/no-img-element */}<img src={src} alt="" className="h-full w-full object-cover" /></span><input type="checkbox" name="removeImage" value={src} /> remove</label>)}</div>}
          <div className="sm:col-span-3"><SubmitButton>Save product</SubmitButton></div>
        </form>
      )}
      <form className="mb-3 flex flex-wrap gap-2"><input name="q" defaultValue={sp.q} placeholder="Search name or SKU" className="input max-w-xs" /><select name="cat" defaultValue={sp.cat ?? ""} className="input max-w-52"><option value="">All categories</option>{catOpts.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</select><button className="btn btn-outline btn-sm">Filter</button></form>
      {list.length === 0 ? <EmptyState title="No products yet" hint="Add your first product to open the shop for members." /> : (
        <div className="card overflow-x-auto !p-0"><table className="tbl"><thead><tr><th>Product</th><th>Category</th><th>Price</th><th>Stock</th><th>Status</th><th></th></tr></thead>
          <tbody>{list.map(({ p, cat }) => (
            <tr key={p.id}><td><div className="flex items-center gap-2"><span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded bg-slate-100">{p.images[0] ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={p.images[0]} alt="" className="h-full w-full object-cover" /> : <ImageOff size={16} className="text-slate-300" />}</span><span className="font-semibold">{p.name}<span className="block text-[11px] font-normal text-slate-500">{p.sku}</span></span></div></td>
              <td>{cat ?? "—"}</td><td>{formatINR(p.pricePaise)}<span className="block text-[11px] text-slate-400 line-through">{formatINR(p.mrpPaise)}</span></td>
              <td className={p.stock <= p.minStock ? "font-semibold text-red-600" : ""}>{p.stock}</td><td><StatusBadge status={p.status === "archived" ? "cancelled" : p.status} text={p.status} /></td>
              <td className="flex gap-1">{can(ctx, "shop", "edit") && <Link href={`/admin/shop/products?edit=${p.id}`} className="btn btn-outline btn-sm">Edit</Link>}
                {can(ctx, "shop", "delete") && <form action={archiveProductAction}><input type="hidden" name="id" value={p.id} />{p.status === "archived" ? <><input type="hidden" name="restore" value="1" /><SubmitButton className="btn-outline btn-sm">Restore</SubmitButton></> : <SubmitButton className="btn-danger btn-sm" confirm="Archive this product? It disappears from the shop but order history is kept.">Archive</SubmitButton>}</form>}</td></tr>))}</tbody></table></div>
      )}
    </>
  );
}
