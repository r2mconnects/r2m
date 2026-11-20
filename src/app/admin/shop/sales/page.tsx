import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { orderItems, orders, productCategories, products } from "@/db/schema";
import { Bars } from "@/components/dashboard/Charts";
import { EmptyState, PageHeader, StatCard } from "@/components/shared/ui";
import { can, requirePermission } from "@/lib/auth/session";
import { formatINR } from "@/lib/utils";

export const metadata = { title: "Sales reports" };

export default async function SalesPage() {
  const ctx = await requirePermission("shop", "view");
  const paid = sql`${orders.paymentStatus} = 'paid' and ${orders.status} not in ('cancelled','refunded','returned')`;
  const [tot] = await db.select({ n: sql<number>`count(*)::int`, s: sql<number>`coalesce(sum(${orders.totalPaise}),0)::bigint`, g: sql<number>`coalesce(sum(${orders.gstPaise}),0)::bigint` }).from(orders).where(paid);
  const monthly = await db.select({ m: sql<string>`to_char(date_trunc('month', ${orders.createdAt}),'Mon YY')`, k: sql<string>`to_char(date_trunc('month', ${orders.createdAt}),'YYYY-MM')`, s: sql<number>`sum(${orders.totalPaise})::bigint` }).from(orders).where(paid).groupBy(sql`1,2`).orderBy(sql`2`).limit(12);
  const topProducts = await db.select({ name: orderItems.name, qty: sql<number>`sum(${orderItems.qty})::int`, rev: sql<number>`sum(${orderItems.qty} * ${orderItems.unitPaise})::bigint` }).from(orderItems).innerJoin(orders, eq(orders.id, orderItems.orderId)).where(paid).groupBy(orderItems.name).orderBy(desc(sql`3`)).limit(10);
  const topCats = await db.select({ name: productCategories.name, rev: sql<number>`sum(${orderItems.qty} * ${orderItems.unitPaise})::bigint` }).from(orderItems).innerJoin(orders, eq(orders.id, orderItems.orderId)).innerJoin(products, eq(products.id, orderItems.productId)).innerJoin(productCategories, eq(productCategories.id, products.categoryId)).where(paid).groupBy(productCategories.name).orderBy(desc(sql`2`)).limit(8);
  return (
    <>
      <PageHeader title="Shop Sales Reports" subtitle="Product sales only — never mixed with membership fees or welfare funds." crumbs={[{ label: "Shop" }, { label: "Sales" }]} actions={can(ctx, "shop", "export") ? <a href="/api/reports/export?type=sales" className="btn btn-outline btn-sm">Export CSV</a> : undefined} />
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4"><StatCard label="Paid orders" value={tot.n} tone="purple" /><StatCard label="Sales" value={formatINR(Number(tot.s))} tone="green" /><StatCard label="GST included" value={formatINR(Number(tot.g))} /></div>
      {tot.n === 0 ? <EmptyState title="No paid orders yet" /> : (
        <div className="grid gap-4 lg:grid-cols-2">
          <section className="card"><h2 className="mb-2 font-bold text-navy">Monthly sales (₹)</h2><Bars data={monthly.map((m) => ({ label: m.m, value: Math.round(Number(m.s) / 100) }))} prefix="₹" /></section>
          <section className="card"><h2 className="mb-2 font-bold text-navy">Top-selling categories (₹)</h2><Bars data={topCats.map((m) => ({ label: m.name.slice(0, 12), value: Math.round(Number(m.rev) / 100) }))} color="#F59E0B" prefix="₹" /></section>
          <section className="card overflow-x-auto lg:col-span-2 !p-0"><table className="tbl"><thead><tr><th>Product</th><th>Units</th><th>Revenue</th></tr></thead><tbody>{topProducts.map((p) => <tr key={p.name}><td>{p.name}</td><td>{p.qty}</td><td>{formatINR(Number(p.rev))}</td></tr>)}</tbody></table></section>
        </div>
      )}
    </>
  );
}
