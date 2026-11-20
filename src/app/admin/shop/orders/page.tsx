import Link from "next/link";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { orderItems, orders, productReturns } from "@/db/schema";
import { processRefundAction, recordOrderPaymentAction, updateOrderStatusAction } from "@/actions/shop.actions";
import { SubmitButton } from "@/components/forms/controls";
import { EmptyState, Flash, PageHeader, StatusBadge } from "@/components/shared/ui";
import { ORDER_STATUSES, label } from "@/constants/status";
import { can, requirePermission } from "@/lib/auth/session";
import { formatDateTime, formatINR } from "@/lib/utils";

export const metadata = { title: "Orders" };

export default async function OrdersAdmin({ searchParams }: { searchParams: Promise<{ status?: string; open?: string; msg?: string; err?: string }> }) {
  const sp = await searchParams;
  const ctx = await requirePermission("orders", "view");
  const list = await db.select().from(orders).where(sp.status ? eq(orders.status, sp.status) : undefined).orderBy(desc(orders.createdAt)).limit(150);
  const open = sp.open ? (await db.select().from(orders).where(eq(orders.id, sp.open)))[0] : undefined;
  const items = open ? await db.select().from(orderItems).where(eq(orderItems.orderId, open.id)) : [];
  const ret = open ? (await db.select().from(productReturns).where(and(eq(productReturns.orderId, open.id))).orderBy(desc(productReturns.createdAt)))[0] : undefined;
  const edit = can(ctx, "orders", "edit");
  const manage = can(ctx, "orders", "manage");
  return (
    <>
      <PageHeader title="Orders" crumbs={[{ label: "Shop" }, { label: "Orders" }]} actions={can(ctx, "orders", "export") ? <a href="/api/reports/export?type=orders" className="btn btn-outline btn-sm">Export CSV</a> : undefined} />
      <Flash sp={sp} />
      <div className="mb-3 flex gap-1 overflow-x-auto pb-1 text-xs">{[["", "All"], ...ORDER_STATUSES.map((s) => [s, label(s)])].map(([k, v]) => <Link key={k} href={`/admin/shop/orders${k ? `?status=${k}` : ""}`} className={`whitespace-nowrap rounded-full border px-3 py-1 font-semibold ${(sp.status ?? "") === k ? "bg-navy text-white" : "bg-white text-navy"}`}>{v}</Link>)}</div>
      {open && (
        <section className="card mb-4 space-y-3 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-bold text-navy">{open.orderNo} <StatusBadge status={open.status} /></h2><Link href={`/shop/orders/${open.id}/invoice`} className="link text-xs">Invoice</Link></div>
          <p>{open.address.name} • {open.address.mobile} • {open.fulfilment === "pickup" ? "Pickup" : [open.address.address, open.address.village, open.address.mandal, open.address.district, open.address.pin].filter(Boolean).join(", ")}</p>
          <ul className="list-disc pl-5">{items.map((i) => <li key={i.id}>{i.name} × {i.qty} — {formatINR(i.unitPaise * i.qty)}</li>)}</ul>
          <p><b>Total {formatINR(open.totalPaise)}</b> • {label(open.paymentMethod)} / {label(open.paymentStatus)} • stock {open.stockDeducted ? "deducted" : "not deducted"}</p>
          {ret && <p className="rounded bg-amber-50 p-2">Return request: {ret.reason} ({ret.status})</p>}
          {edit && (
            <form action={updateOrderStatusAction} className="flex flex-wrap items-center gap-2"><input type="hidden" name="id" value={open.id} />
              <select name="status" defaultValue={open.status} className="input max-w-52">{ORDER_STATUSES.filter((s) => s !== "refunded").map((s) => <option key={s} value={s}>{label(s)}</option>)}</select><SubmitButton>Update status</SubmitButton></form>
          )}
          {manage && open.paymentStatus === "pending" && open.status !== "cancelled" && (
            <form action={recordOrderPaymentAction} className="flex flex-wrap items-center gap-2 border-t pt-3"><input type="hidden" name="id" value={open.id} />
              <select name="method" className="input max-w-32"><option value="cash">Cash</option><option value="upi">UPI</option><option value="bank">Bank</option></select><input name="reference" required placeholder="Payment reference / UTR" className="input max-w-64" /><SubmitButton confirm="Record this offline payment as received?">Record payment received</SubmitButton></form>
          )}
          {manage && open.paymentStatus === "paid" && ["cancelled", "returned", "return_requested"].includes(open.status) && (
            <form action={processRefundAction} className="flex flex-wrap items-center gap-2 border-t pt-3"><input type="hidden" name="id" value={open.id} />
              <input name="amount" type="number" step="0.01" placeholder={`Refund ₹ (default ${open.totalPaise / 100})`} className="input max-w-52" /><input name="reference" placeholder="Reference / UTR" className="input max-w-48" /><label className="flex items-center gap-1 text-xs"><input type="checkbox" name="viaGateway" value="1" /> Refund via Razorpay</label><SubmitButton className="btn-danger" confirm="Process this refund?">Process refund</SubmitButton></form>
          )}
        </section>
      )}
      {list.length === 0 ? <EmptyState title="No orders" /> : (
        <div className="card overflow-x-auto !p-0"><table className="tbl"><thead><tr><th>Order</th><th>Customer</th><th>Date</th><th>Amount</th><th>Payment</th><th>Status</th></tr></thead>
          <tbody>{list.map((o) => <tr key={o.id}><td><Link className="link" href={`/admin/shop/orders?open=${o.id}`}>{o.orderNo}</Link></td><td>{o.address.name}</td><td>{formatDateTime(o.createdAt)}</td><td>{formatINR(o.totalPaise)}</td><td><StatusBadge status={o.paymentStatus} /></td><td><StatusBadge status={o.status} /></td></tr>)}</tbody></table></div>
      )}
    </>
  );
}
