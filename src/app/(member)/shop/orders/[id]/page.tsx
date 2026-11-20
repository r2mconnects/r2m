import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { orderItems, orders } from "@/db/schema";
import { cancelOrderAction, requestReturnAction } from "@/actions/shop.actions";
import { SubmitButton } from "@/components/forms/controls";
import { PayButton } from "@/components/shared/PayButton";
import { Flash, PageHeader, StatusBadge } from "@/components/shared/ui";
import { requireMember } from "@/lib/auth/session";
import { razorpayConfigured } from "@/lib/payments/razorpay";
import { formatDateTime, formatINR, label } from "@/lib/utils";

const FLOW = ["payment_pending", "paid", "confirmed", "processing", "packed", "shipped", "out_for_delivery", "delivered"];

export default async function OrderDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ msg?: string; err?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const ctx = await requireMember();
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const [o] = await db.select().from(orders).where(and(eq(orders.id, id), eq(orders.userId, ctx.user.id)));
  if (!o) notFound();
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, id));
  const step = FLOW.indexOf(o.status);
  const cancellable = ["pending", "payment_pending", "paid", "confirmed"].includes(o.status);
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <PageHeader title={o.orderNo} subtitle={formatDateTime(o.createdAt)} crumbs={[{ label: "Orders", href: "/shop/orders" }, { label: o.orderNo }]} actions={<StatusBadge status={o.status} />} />
      <Flash sp={sp} />
      {step >= 0 && (
        <ol className="card flex gap-1 overflow-x-auto text-[11px]">
          {FLOW.map((s, i) => <li key={s} className={`flex-1 whitespace-nowrap rounded-md px-2 py-1 text-center font-semibold ${i <= step ? "bg-navy text-white" : "bg-slate-100 text-slate-400"}`}>{label(s)}</li>)}
        </ol>
      )}
      {o.status === "payment_pending" && o.paymentMethod === "online" && (
        <div className="card border-amber-200 bg-amber-50 text-sm">
          <p className="mb-2 font-semibold text-amber-900">Payment pending — {formatINR(o.totalPaise)}</p>
          {razorpayConfigured() ? <PayButton kind="shop_order" orderId={o.id} label="Pay now" /> : <p className="text-xs text-amber-800">Online payment is not configured. The association will confirm your payment once received; you can also cancel this order.</p>}
        </div>
      )}
      <section className="card overflow-x-auto !p-0">
        <table className="tbl"><thead><tr><th>Item</th><th>Qty</th><th>Price</th><th>Total</th></tr></thead>
          <tbody>{items.map((i) => <tr key={i.id}><td>{i.name}<span className="block text-[11px] text-slate-400">{i.sku}</span></td><td>{i.qty}</td><td>{formatINR(i.unitPaise)}</td><td>{formatINR(i.unitPaise * i.qty)}</td></tr>)}</tbody></table>
        <div className="space-y-1 border-t p-3 text-sm">
          <div className="flex justify-between"><span>Subtotal</span><span>{formatINR(o.subtotalPaise)}</span></div>
          {o.discountPaise > 0 && <div className="flex justify-between text-green-700"><span>Discount {o.couponCode && `(${o.couponCode})`}</span><span>−{formatINR(o.discountPaise)}</span></div>}
          <div className="flex justify-between"><span>Delivery</span><span>{formatINR(o.deliveryPaise)}</span></div>
          <div className="flex justify-between text-xs text-slate-500"><span>GST included</span><span>{formatINR(o.gstPaise)}</span></div>
          <div className="flex justify-between text-base font-bold"><span>Total</span><span>{formatINR(o.totalPaise)}</span></div>
          <p className="text-xs text-slate-500">Payment: {label(o.paymentMethod)} — {label(o.paymentStatus)}</p>
        </div>
      </section>
      <section className="card text-sm">
        <h2 className="mb-1 font-bold text-navy">{o.fulfilment === "pickup" ? "Shop pickup" : "Delivery address"}</h2>
        <p>{o.address.name} • {o.address.mobile}</p>
        {o.fulfilment === "delivery" && <p>{[o.address.address, o.address.village, o.address.mandal, o.address.district, o.address.pin].filter(Boolean).join(", ")}</p>}
      </section>
      <div className="flex flex-wrap gap-2">
        {o.paymentStatus === "paid" || o.status === "delivered" ? <Link href={`/shop/orders/${o.id}/invoice`} className="btn btn-primary btn-sm">Download invoice</Link> : null}
        {cancellable && (
          <form action={cancelOrderAction} className="flex gap-2">
            <input type="hidden" name="id" value={o.id} /><input type="hidden" name="reason" value="Cancelled by member" />
            <SubmitButton className="btn-outline btn-sm" confirm="Cancel this order?">Cancel order</SubmitButton>
          </form>
        )}
      </div>
      {o.status === "delivered" && (
        <form action={requestReturnAction} className="card space-y-2">
          <input type="hidden" name="id" value={o.id} />
          <h2 className="text-sm font-bold text-navy">Request return / refund</h2>
          <textarea name="reason" required rows={2} className="input" placeholder="Reason for return" />
          <SubmitButton className="btn-outline btn-sm">Request return</SubmitButton>
        </form>
      )}
    </div>
  );
}
