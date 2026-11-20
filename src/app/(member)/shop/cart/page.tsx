import Link from "next/link";
import { ImageOff, Trash2 } from "lucide-react";
import { applyCouponAction, updateCartAction } from "@/actions/shop.actions";
import { SubmitButton } from "@/components/forms/controls";
import { EmptyState, Flash, PageHeader } from "@/components/shared/ui";
import { requireMember } from "@/lib/auth/session";
import { priceCart } from "@/lib/data/shop";
import { formatINR } from "@/lib/utils";

export const metadata = { title: "Cart" };

export default async function CartPage({ searchParams }: { searchParams: Promise<{ coupon?: string; msg?: string; err?: string }> }) {
  const sp = await searchParams;
  const ctx = await requireMember();
  const c = await priceCart(ctx.user.id, sp.coupon);
  const stockIssue = c.lines.find((l) => l.stock < l.qty);
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Shopping Cart" crumbs={[{ label: "Shop", href: "/shop" }, { label: "Cart" }]} />
      <Flash sp={sp} />
      {c.lines.length === 0 ? (
        <EmptyState title="Your cart is empty" action={<Link href="/shop" className="btn btn-primary btn-sm">Browse products</Link>} />
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2 md:col-span-2">
            {c.lines.map((l) => (
              <div key={l.id} className="card flex gap-3 !p-3">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-100">
                  {l.images[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={l.images[0]} alt="" className="h-full w-full object-cover" />
                  ) : <ImageOff className="text-slate-300" />}
                </div>
                <div className="min-w-0 flex-1">
                  <Link href={`/shop/products/${l.productId}`} className="line-clamp-2 text-sm font-semibold text-navy">{l.name}</Link>
                  <p className="text-xs text-slate-500">{formatINR(l.unit)} each {l.stock < l.qty && <span className="font-semibold text-red-600">• only {l.stock} in stock</span>}</p>
                  <form action={updateCartAction} className="mt-1 flex items-center gap-2">
                    <input type="hidden" name="id" value={l.id} />
                    <input name="qty" type="number" min={1} max={Math.max(l.stock, 1)} defaultValue={l.qty} className="input !min-h-8 w-20 !py-1" aria-label="Quantity" />
                    <button className="btn btn-outline btn-sm">Update</button>
                    <button name="remove" value="1" className="btn btn-sm text-red-600" aria-label="Remove"><Trash2 size={14} /></button>
                  </form>
                </div>
                <p className="text-sm font-bold">{formatINR(l.unit * l.qty)}</p>
              </div>
            ))}
          </div>
          <div className="space-y-3">
            <form action={applyCouponAction} className="card flex gap-2 !p-3">
              <input name="coupon" defaultValue={sp.coupon} placeholder="Coupon code" className="input uppercase" aria-label="Coupon code" />
              <button className="btn btn-outline">Apply</button>
            </form>
            {sp.coupon && c.couponMsg && <p className="text-xs text-red-600">{c.couponMsg}</p>}
            <div className="card space-y-1 text-sm">
              <div className="flex justify-between"><span>Subtotal</span><span>{formatINR(c.subtotal)}</span></div>
              {c.discount > 0 && <div className="flex justify-between text-green-700"><span>Coupon ({c.couponOk})</span><span>−{formatINR(c.discount)}</span></div>}
              <div className="flex justify-between"><span>Delivery</span><span>{c.delivery ? formatINR(c.delivery) : "Free / pickup"}</span></div>
              <div className="flex justify-between text-xs text-slate-500"><span>GST included</span><span>{formatINR(c.gst)}</span></div>
              <div className="flex justify-between border-t pt-2 text-base font-bold"><span>Total</span><span>{formatINR(c.total)}</span></div>
              {stockIssue ? <p className="text-xs text-red-600">Fix the quantities above to continue.</p> : (
                <Link href={`/shop/checkout${c.couponOk ? `?coupon=${c.couponOk}` : ""}`} className="btn btn-primary mt-2 w-full">Proceed to checkout</Link>
              )}
              <p className="text-[11px] text-slate-400">Prices and stock are re-verified on the server at checkout.</p>
            </div>
          </div>
        </div>
      )}
      <span className="hidden"><SubmitButton>x</SubmitButton></span>
    </div>
  );
}
