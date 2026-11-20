import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { orderItems, orders } from "@/db/schema";
import { Logo } from "@/components/shared/Logo";
import { PrintButton } from "@/components/shared/PrintButton";
import { can, requireUser } from "@/lib/auth/session";
import { getSettings } from "@/lib/settings";
import { formatDate, formatINR } from "@/lib/utils";

export const metadata = { title: "Invoice" };

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const ctx = await requireUser();
  const [o] = await db.select().from(orders).where(eq(orders.id, id));
  if (!o || (o.userId !== ctx.user.id && !can(ctx, "orders", "view"))) notFound();
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, id));
  const s = await getSettings();
  const ratio = o.subtotalPaise > 0 ? (o.subtotalPaise - o.discountPaise) / o.subtotalPaise : 1;
  return (
    <div className="mx-auto max-w-3xl">
      <div className="card print-area space-y-4 text-sm">
        <div className="flex items-start justify-between">
          <div><Logo /><p className="mt-1 text-xs text-slate-500">{s.associationName}<br />{s.contactAddress}<br />{s.contactPhone} {s.contactEmail}</p></div>
          <div className="text-right"><p className="text-lg font-bold text-navy">TAX INVOICE</p><p>{o.invoiceNo ?? o.orderNo}</p><p className="text-xs">Order {o.orderNo} • {formatDate(o.createdAt)}</p><p className="text-xs">Payment: {o.paymentStatus}</p></div>
        </div>
        <div><p className="text-xs font-semibold text-slate-500">Billed to</p><p>{o.address.name} • {o.address.mobile}</p><p className="text-xs">{[o.address.address, o.address.village, o.address.mandal, o.address.district, o.address.pin].filter(Boolean).join(", ")}</p></div>
        <table className="tbl">
          <thead><tr><th>Item</th><th>HSN</th><th>Qty</th><th>Rate (incl. GST)</th><th>GST %</th><th>Taxable</th><th>GST</th><th>Amount</th></tr></thead>
          <tbody>
            {items.map((i) => {
              const gross = i.unitPaise * i.qty * ratio;
              const tax = Math.round((gross * i.gstRate) / (100 + i.gstRate));
              return <tr key={i.id}><td>{i.name}<span className="block text-[10px] text-slate-400">{i.sku}</span></td><td>{i.hsn ?? "—"}</td><td>{i.qty}</td><td>{formatINR(i.unitPaise)}</td><td>{i.gstRate}%</td><td>{formatINR(Math.round(gross) - tax)}</td><td>{formatINR(tax)}</td><td>{formatINR(Math.round(gross))}</td></tr>;
            })}
          </tbody>
        </table>
        <div className="ml-auto w-64 space-y-1">
          <div className="flex justify-between"><span>Subtotal</span><span>{formatINR(o.subtotalPaise)}</span></div>
          {o.discountPaise > 0 && <div className="flex justify-between"><span>Discount</span><span>−{formatINR(o.discountPaise)}</span></div>}
          <div className="flex justify-between"><span>Delivery</span><span>{formatINR(o.deliveryPaise)}</span></div>
          <div className="flex justify-between text-xs text-slate-500"><span>Total GST included</span><span>{formatINR(o.gstPaise)}</span></div>
          <div className="flex justify-between border-t pt-1 text-base font-bold"><span>Grand total</span><span>{formatINR(o.totalPaise)}</span></div>
        </div>
        <p className="text-[11px] text-slate-400">Shop sales are recorded separately from membership fees and welfare funds. This invoice is computer generated.</p>
      </div>
      <div className="no-print mt-3"><PrintButton text="Print / Save invoice as PDF" /></div>
    </div>
  );
}
