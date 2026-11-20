import { PayButton } from "@/components/shared/PayButton";
import { EmptyState, PageHeader, StatusBadge } from "@/components/shared/ui";
import { requireMember } from "@/lib/auth/session";
import { renewalFee } from "@/lib/membership/membership";
import { razorpayConfigured } from "@/lib/payments/razorpay";
import { formatDate, formatINR } from "@/lib/utils";

export const metadata = { title: "Renewal" };

export default async function RenewalPage() {
  const { member: m } = await requireMember();
  if (!m.membershipNo)
    return (
      <div className="mx-auto max-w-xl">
        <PageHeader title="Membership Renewal" />
        <EmptyState title="Renewal not available yet" hint="You can renew after your membership has been approved." />
      </div>
    );
  const fee = await renewalFee(m);
  const configured = razorpayConfigured();
  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title="Membership Renewal" crumbs={[{ label: "Member", href: "/member" }, { label: "Renewal" }]} />
      <section className="card space-y-2 text-sm">
        <p><b>Status:</b> <StatusBadge status={m.status} /></p>
        <p><b>Current expiry:</b> {formatDate(m.validTill)}</p>
        <p><b>Plan:</b> {fee.plan?.name ?? "—"} ({fee.plan?.validityMonths ?? 12} months)</p>
        <p><b>Renewal fee:</b> {fee.amountPaise > 0 ? formatINR(fee.amountPaise) : "Not configured"}{fee.late && " (includes late fee)"}</p>
        <p className="text-xs text-slate-500">Your new validity is calculated by the server after the payment is verified. Your ID card updates automatically.</p>
        {m.status === "suspended" ? (
          <p className="text-red-700">Membership suspended — contact the office.</p>
        ) : fee.amountPaise <= 0 ? (
          <p className="text-amber-700">The renewal fee has not been configured by the association yet.</p>
        ) : configured ? (
          <PayButton kind="renewal" label={`Renew • ${formatINR(fee.amountPaise)}`} />
        ) : (
          <p className="rounded-lg bg-amber-50 p-2 text-amber-800">Online payment is not configured yet. Please pay your agent or the association office — they will record and verify the collection, and your validity will be extended.</p>
        )}
      </section>
    </div>
  );
}
