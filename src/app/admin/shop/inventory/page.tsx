import { asc, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { products, stockMovements, users } from "@/db/schema";
import { adjustStockAction } from "@/actions/product.actions";
import { Field } from "@/components/forms/Field";
import { SubmitButton } from "@/components/forms/controls";
import { EmptyState, Flash, PageHeader, StatCard } from "@/components/shared/ui";
import { can, requirePermission } from "@/lib/auth/session";
import { formatDateTime, label } from "@/lib/utils";

export const metadata = { title: "Inventory" };

export default async function InventoryPage({ searchParams }: { searchParams: Promise<{ msg?: string; err?: string }> }) {
  const sp = await searchParams;
  const ctx = await requirePermission("shop", "view");
  const list = await db.select().from(products).orderBy(asc(products.name));
  const low = list.filter((p) => p.status !== "archived" && p.stock <= p.minStock);
  const moves = await db.select({ m: stockMovements, p: products.name, who: users.fullName }).from(stockMovements).innerJoin(products, eq(products.id, stockMovements.productId)).leftJoin(users, eq(users.id, stockMovements.userId)).orderBy(desc(stockMovements.createdAt)).limit(40);
  void sql;
  return (
    <>
      <PageHeader title="Inventory" subtitle="Every stock change records a reason, source and responsible user." crumbs={[{ label: "Shop" }, { label: "Inventory" }]} />
      <Flash sp={sp} />
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4"><StatCard label="Products" value={list.length} /><StatCard label="Low / out of stock" value={low.length} tone="red" /><StatCard label="Units on hand" value={list.reduce((a, p) => a + Math.max(p.stock, 0), 0)} tone="green" /></div>
      {can(ctx, "shop", "edit") && list.length > 0 && (
        <form action={adjustStockAction} className="card mb-4 grid gap-3 sm:grid-cols-6">
          <Field label="Product" name="productId" required options={[{ value: "", label: "Select" }, ...list.map((p) => ({ value: p.id, label: `${p.name} (${p.stock})` }))]} className="sm:col-span-2" />
          <Field label="Type" name="type" required options={[{ value: "purchase", label: "Purchase (+)" }, { value: "return", label: "Return (+)" }, { value: "adjustment", label: "Adjustment (±)" }]} />
          <Field label="Quantity" name="qty" type="number" required hint="Adjustments may be negative" />
          <Field label="Reason" name="reason" required />
          <Field label="Source / supplier" name="source" />
          <div className="sm:col-span-6"><SubmitButton>Record stock movement</SubmitButton></div>
        </form>
      )}
      {low.length > 0 && <section className="card mb-4"><h2 className="mb-1 text-sm font-bold text-red-700">Low-stock alerts</h2><p className="text-sm">{low.map((p) => `${p.name} (${p.stock})`).join(" • ")}</p></section>}
      {moves.length === 0 ? <EmptyState title="No stock movements yet" /> : (
        <div className="card overflow-x-auto !p-0"><table className="tbl"><thead><tr><th>When</th><th>Product</th><th>Type</th><th>Qty</th><th>Reason</th><th>Source</th><th>By</th></tr></thead>
          <tbody>{moves.map(({ m, p, who }) => <tr key={m.id}><td>{formatDateTime(m.createdAt)}</td><td>{p}</td><td>{label(m.type)}</td><td className={m.qty < 0 ? "text-red-600" : "text-green-700"}>{m.qty > 0 ? "+" : ""}{m.qty}</td><td>{m.reason}</td><td>{m.source ?? "—"}</td><td>{who ?? "System"}</td></tr>)}</tbody></table></div>
      )}
    </>
  );
}
