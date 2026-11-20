import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { orders } from "@/db/schema";
import { EmptyState, Flash, PageHeader, StatusBadge } from "@/components/shared/ui";
import { requireMember } from "@/lib/auth/session";
import { formatDate, formatINR } from "@/lib/utils";

export const metadata = { title: "My orders" };

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ msg?: string; err?: string }> }) {
  const sp = await searchParams;
  const ctx = await requireMember();
  const list = await db.select().from(orders).where(eq(orders.userId, ctx.user.id)).orderBy(desc(orders.createdAt));
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="My Orders" crumbs={[{ label: "Shop", href: "/shop" }, { label: "Orders" }]} />
      <Flash sp={sp} />
      {list.length === 0 ? <EmptyState title="No orders yet" action={<Link href="/shop" className="btn btn-primary btn-sm">Start shopping</Link>} /> : (
        <div className="space-y-2">
          {list.map((o) => (
            <Link key={o.id} href={`/shop/orders/${o.id}`} className="card flex items-center justify-between !p-3 hover:border-royal">
              <span><span className="block font-semibold text-navy">{o.orderNo}</span><span className="text-xs text-slate-500">{formatDate(o.createdAt)}</span></span>
              <span className="text-right"><span className="block font-bold">{formatINR(o.totalPaise)}</span><StatusBadge status={o.status} /></span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
