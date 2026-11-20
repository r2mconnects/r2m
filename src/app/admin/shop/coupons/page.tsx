import { desc } from "drizzle-orm";
import { db } from "@/db";
import { coupons } from "@/db/schema";
import { saveCouponAction, toggleCouponAction } from "@/actions/product.actions";
import { Field } from "@/components/forms/Field";
import { SubmitButton } from "@/components/forms/controls";
import { EmptyState, Flash, PageHeader, StatusBadge } from "@/components/shared/ui";
import { can, requirePermission } from "@/lib/auth/session";
import { formatDate, formatINR } from "@/lib/utils";

export const metadata = { title: "Coupons" };

export default async function CouponsPage({ searchParams }: { searchParams: Promise<{ msg?: string; err?: string }> }) {
  const sp = await searchParams;
  const ctx = await requirePermission("shop", "view");
  const list = await db.select().from(coupons).orderBy(desc(coupons.createdAt));
  const manage = can(ctx, "shop", "manage");
  return (
    <>
      <PageHeader title="Coupons" crumbs={[{ label: "Shop" }, { label: "Coupons" }]} />
      <Flash sp={sp} />
      {manage && (
        <form action={saveCouponAction} className="card mb-4 grid gap-3 sm:grid-cols-4">
          <Field label="Code" name="code" required />
          <Field label="Type" name="kind" required options={[{ value: "percent", label: "Percent %" }, { value: "flat", label: "Flat ₹" }]} />
          <Field label="Value" name="value" type="number" min={1} required />
          <Field label="Min order (₹)" name="minOrder" type="number" min={0} />
          <Field label="Max discount (₹)" name="maxDiscount" type="number" min={0} />
          <Field label="Usage limit" name="usageLimit" type="number" min={1} />
          <Field label="Expires on" name="expiresAt" type="date" />
          <div className="flex items-end"><SubmitButton>Create coupon</SubmitButton></div>
        </form>
      )}
      {list.length === 0 ? <EmptyState title="No coupons" /> : (
        <div className="card overflow-x-auto !p-0"><table className="tbl"><thead><tr><th>Code</th><th>Discount</th><th>Min order</th><th>Used</th><th>Expires</th><th>Status</th>{manage && <th></th>}</tr></thead>
          <tbody>{list.map((c) => <tr key={c.id}><td className="font-mono font-semibold">{c.code}</td><td>{c.kind === "percent" ? `${c.value}%` : formatINR(c.value)}</td><td>{formatINR(c.minOrderPaise)}</td><td>{c.used}{c.usageLimit ? `/${c.usageLimit}` : ""}</td><td>{formatDate(c.expiresAt)}</td><td><StatusBadge status={c.active ? "active" : "suspended"} text={c.active ? "Active" : "Disabled"} /></td>
            {manage && <td><form action={toggleCouponAction}><input type="hidden" name="id" value={c.id} /><input type="hidden" name="active" value={c.active ? "0" : "1"} /><SubmitButton className="btn-outline btn-sm">{c.active ? "Disable" : "Enable"}</SubmitButton></form></td>}</tr>)}</tbody></table></div>
      )}
    </>
  );
}
