import { redirect } from "next/navigation";
import { randomUUID } from "crypto";
import { checkoutAction } from "@/actions/shop.actions";
import { Field } from "@/components/forms/Field";
import { GeoSelect, SubmitButton } from "@/components/forms/controls";
import { Flash, PageHeader } from "@/components/shared/ui";
import { requireMember } from "@/lib/auth/session";
import { getDistricts, getMandals } from "@/lib/data/geo";
import { priceCart } from "@/lib/data/shop";
import { razorpayConfigured } from "@/lib/payments/razorpay";
import { getSettings } from "@/lib/settings";
import { formatINR } from "@/lib/utils";

export const metadata = { title: "Checkout" };

export default async function CheckoutPage({ searchParams }: { searchParams: Promise<{ coupon?: string; msg?: string; err?: string }> }) {
  const sp = await searchParams;
  const ctx = await requireMember();
  const m = ctx.member;
  const [c, s, ds, ms] = await Promise.all([priceCart(ctx.user.id, sp.coupon), getSettings(), getDistricts(), getMandals()]);
  if (c.lines.length === 0) redirect("/shop/cart");
  const online = razorpayConfigured();
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Checkout" crumbs={[{ label: "Shop", href: "/shop" }, { label: "Cart", href: "/shop/cart" }, { label: "Checkout" }]} />
      <Flash sp={sp} />
      <form action={checkoutAction} className="grid gap-4 md:grid-cols-3">
        <input type="hidden" name="checkoutKey" value={randomUUID()} />
        <input type="hidden" name="coupon" value={c.couponOk ?? ""} />
        <div className="card grid gap-3 sm:grid-cols-2 md:col-span-2">
          <h2 className="text-sm font-bold text-navy sm:col-span-2">Contact & delivery</h2>
          <Field label="Customer name" name="name" required defaultValue={m.fullName} />
          <Field label="Mobile number" name="mobile" required type="tel" defaultValue={m.mobile} />
          <Field label="Fulfilment" name="fulfilment" required defaultValue="delivery" options={[{ value: "delivery", label: "Home / workshop delivery" }, ...(s.pickupEnabled ? [{ value: "pickup", label: "Pickup from association shop (no delivery charge)" }] : [])]} className="sm:col-span-2" />
          <Field label="Delivery address" name="address" rows={2} defaultValue={m.workshopAddress ?? m.address} className="sm:col-span-2" hint="Required for delivery." />
          <GeoSelect districts={ds} mandals={ms} districtId={m.districtId} mandalId={m.mandalId} required={false} />
          <Field label="Village" name="village" defaultValue={m.village} />
          <Field label="PIN code" name="pin" placeholder="6 digits" />
          <Field label="Delivery instructions" name="instructions" className="sm:col-span-2" />
        </div>
        <div className="space-y-3">
          <div className="card space-y-1 text-sm">
            <h2 className="mb-1 text-sm font-bold text-navy">Order summary</h2>
            {c.lines.map((l) => <div key={l.id} className="flex justify-between gap-2"><span className="truncate">{l.name} × {l.qty}</span><span>{formatINR(l.unit * l.qty)}</span></div>)}
            <div className="flex justify-between border-t pt-1"><span>Subtotal</span><span>{formatINR(c.subtotal)}</span></div>
            {c.discount > 0 && <div className="flex justify-between text-green-700"><span>Coupon</span><span>−{formatINR(c.discount)}</span></div>}
            <div className="flex justify-between"><span>Delivery (if chosen)</span><span>{c.delivery ? formatINR(c.delivery) : "Free"}</span></div>
            <div className="flex justify-between border-t pt-1 text-base font-bold"><span>Total</span><span>{formatINR(c.total)}</span></div>
            <p className="text-[11px] text-slate-400">Final delivery charge is recalculated on the server for your chosen fulfilment.</p>
          </div>
          <div className="card space-y-2 text-sm">
            <h2 className="text-sm font-bold text-navy">Payment method</h2>
            <label className="flex items-start gap-2"><input type="radio" name="paymentMethod" value="online" defaultChecked className="mt-1" /> <span>Pay online (UPI / cards / net banking via Razorpay){!online && <span className="block text-xs text-amber-700">Gateway not configured yet — the order will wait for payment verification by the association.</span>}</span></label>
            {s.codEnabled && <label className="flex items-start gap-2"><input type="radio" name="paymentMethod" value="cod" className="mt-1" /> <span>Cash on delivery</span></label>}
          </div>
          <SubmitButton className="btn-primary w-full" pending="Placing order…">Place order</SubmitButton>
        </div>
      </form>
    </div>
  );
}
