import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { members, paymentTransactions } from "@/db/schema";
import { Logo } from "@/components/shared/Logo";
import { PrintButton } from "@/components/shared/PrintButton";
import { can, requireUser } from "@/lib/auth/session";
import { getSettings } from "@/lib/settings";
import { formatDateTime, formatINR, label } from "@/lib/utils";

export const metadata = { title: "Receipt" };

export default async function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const ctx = await requireUser();
  const [t] = await db.select().from(paymentTransactions).where(eq(paymentTransactions.id, id));
  if (!t || t.status === "created" || !t.receiptNo) notFound();
  const owner = t.userId === ctx.user.id || (t.memberId && ctx.member?.id === t.memberId);
  if (!owner && !can(ctx, "payments", "view")) notFound();
  const [m] = t.memberId ? await db.select().from(members).where(eq(members.id, t.memberId)) : [];
  const s = await getSettings();
  return (
    <div className="mx-auto max-w-xl">
      <div className="card print-area space-y-3 text-sm">
        <div className="flex items-center justify-between"><Logo /><div className="text-right"><p className="text-lg font-bold text-navy">RECEIPT</p><p className="text-xs">{t.receiptNo}</p></div></div>
        <p className="text-xs text-slate-500">{s.associationName}{s.contactAddress ? ` • ${s.contactAddress}` : ""}</p>
        <hr />
        <p><b>Received from:</b> {m?.fullName ?? "—"} {m?.membershipNo ? `(${m.membershipNo})` : ""}</p>
        <p><b>Purpose:</b> {t.purpose ?? label(t.kind)}</p>
        <p><b>Method:</b> {label(t.method)} {t.gatewayPaymentId && `• Ref ${t.gatewayPaymentId}`}</p>
        <p><b>Date:</b> {formatDateTime(t.paidAt)}</p>
        <p className="text-lg"><b>Amount: {formatINR(t.amountPaise)}</b></p>
        <p className="text-[11px] text-slate-500">This is a system-generated receipt for association {t.kind === "shop_order" ? "shop" : "membership"} payment. Membership fees and shop sales are accounted separately.</p>
      </div>
      <div className="no-print mt-3"><PrintButton /></div>
    </div>
  );
}
