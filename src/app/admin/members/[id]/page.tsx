import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  auditLogs, manualCollections, memberDocuments, membershipCardHistory, paymentTransactions, users, welfareApplications, welfareSchemes,
} from "@/db/schema";
import { cardAdminAction, memberStatusAction, recordCollectionAction, resetLinkAction, updateMemberAction } from "@/actions/membership.actions";
import { CardActions } from "@/components/membership/CardActions";
import { MembershipCard } from "@/components/membership/MembershipCard";
import { Field, Checkbox } from "@/components/forms/Field";
import { GeoSelect, SubmitButton } from "@/components/forms/controls";
import { Avatar, Flash, PageHeader, StatusBadge } from "@/components/shared/ui";
import { can, requirePermission } from "@/lib/auth/session";
import { getDistricts, getMandals } from "@/lib/data/geo";
import { buildCard, getMemberFull } from "@/lib/data/members";
import { inMemberScope } from "@/lib/scope";
import { appOrigin, formatDate, formatDateTime, formatINR, label, toDateInput } from "@/lib/utils";

export default async function AdminMemberPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ msg?: string; err?: string; act?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const ctx = await requirePermission("members", "view");
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const full = await getMemberFull(id);
  if (!full || !inMemberScope(ctx, full.m)) notFound();
  const m = full.m;
  const [ds, ms] = await Promise.all([getDistricts(), getMandals()]);
  const [txns, cols, docs, hist] = await Promise.all([
    db.select().from(paymentTransactions).where(eq(paymentTransactions.memberId, id)).orderBy(desc(paymentTransactions.createdAt)),
    db.select().from(manualCollections).where(eq(manualCollections.memberId, id)).orderBy(desc(manualCollections.createdAt)),
    db.select().from(memberDocuments).where(eq(memberDocuments.memberId, id)),
    db.select().from(membershipCardHistory).where(eq(membershipCardHistory.memberId, id)).orderBy(desc(membershipCardHistory.createdAt)),
  ]);
  const agent = m.agentId ? (await db.select({ n: users.fullName }).from(users).where(eq(users.id, m.agentId)))[0]?.n : null;
  const approver = m.approvedBy ? (await db.select({ n: users.fullName }).from(users).where(eq(users.id, m.approvedBy)))[0]?.n : null;
  const card = m.membershipNo ? await buildCard(id) : null;
  const welfare = can(ctx, "welfare", "view")
    ? await db.select({ w: welfareApplications, s: welfareSchemes.name }).from(welfareApplications).innerJoin(welfareSchemes, eq(welfareSchemes.id, welfareApplications.schemeId)).where(eq(welfareApplications.memberId, id))
    : [];
  const audit = can(ctx, "audit", "view") ? await db.select().from(auditLogs).where(eq(auditLogs.entityId, id)).orderBy(desc(auditLogs.createdAt)).limit(20) : [];
  const origin = await appOrigin();
  const canEdit = can(ctx, "members", "edit");

  return (
    <>
      <PageHeader title={m.fullName} subtitle={`${m.membershipNo ?? m.applicationRef} • ${full.district ?? "—"} / ${full.mandal ?? "—"}`} crumbs={[{ label: "Members", href: "/admin/members" }, { label: m.fullName }]} actions={<StatusBadge status={m.status} />} />
      <Flash sp={sp} />
      {sp.act && <div className="mb-4 break-all rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm"><b>One-time secure link:</b> {origin}/reset-password?token={sp.act}<p className="text-xs text-slate-500">Shown once. Share it only with the member.</p></div>}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <section className="card grid gap-2 text-sm sm:grid-cols-2">
            <div className="flex items-center gap-3 sm:col-span-2"><Avatar src={m.photoUrl} name={m.fullName} size={64} /><div><p className="text-lg font-bold text-navy">{m.fullName}</p><p className="text-xs text-slate-500">{m.workshopName}</p></div></div>
            <p><b>Mobile:</b> {m.mobile}</p><p><b>Email:</b> {m.email ?? "—"}</p>
            <p><b>DOB:</b> {formatDate(m.dob)}</p><p><b>Experience:</b> {m.experienceYears ?? "—"} yrs • {m.specialization ?? "—"}</p>
            <p className="sm:col-span-2"><b>Address:</b> {[m.address, m.village, full.mandal, full.district].filter(Boolean).join(", ")}</p>
            <p><b>Emergency:</b> {m.emergencyName ?? "—"} {m.emergencyPhone}</p><p><b>Nominee:</b> {m.nomineeName ?? "—"} {m.nomineeRelation && `(${m.nomineeRelation})`}</p>
            <p><b>Registered:</b> {formatDateTime(m.createdAt)}</p><p><b>Registering agent:</b> {agent ?? "Self-registered"}</p>
            <p><b>Approved by:</b> {approver ?? "—"} {m.approvedAt && `on ${formatDate(m.approvedAt)}`}</p><p><b>Valid:</b> {formatDate(m.validFrom)} → {formatDate(m.validTill)}</p>
            {m.rejectReason && <p className="sm:col-span-2 text-red-700"><b>Reason:</b> {m.rejectReason}</p>}
          </section>

          {canEdit && (
            <details className="card"><summary className="cursor-pointer text-sm font-bold text-navy">Edit member details</summary>
              <form action={updateMemberAction} className="mt-3 grid gap-3 sm:grid-cols-2">
                <input type="hidden" name="id" value={m.id} />
                <Field label="Full name" name="fullName" required defaultValue={m.fullName} />
                <Field label="Mobile" name="mobile" required defaultValue={m.mobile} />
                <Field label="Email" name="email" type="email" defaultValue={m.email} />
                <Field label="Village" name="village" defaultValue={m.village} />
                <GeoSelect districts={ds} mandals={ms} districtId={m.districtId} mandalId={m.mandalId} />
                <Field label="Address" name="address" defaultValue={m.address} />
                <Field label="Workshop name" name="workshopName" defaultValue={m.workshopName} />
                <Field label="Workshop address" name="workshopAddress" defaultValue={m.workshopAddress} />
                <Field label="Experience (yrs)" name="experienceYears" type="number" defaultValue={m.experienceYears} />
                <Field label="Specialization" name="specialization" defaultValue={m.specialization} />
                <Field label="Replace photo" name="photo" type="file" accept="image/*" />
                <div className="flex items-end"><Checkbox name="directoryVerified" defaultChecked={m.directoryVerified} label={`Verified for mechanic directory${m.directoryOptIn ? " (member opted in)" : " (member has not opted in)"}`} /></div>
                <div className="sm:col-span-2"><SubmitButton>Save changes</SubmitButton></div>
              </form></details>
          )}

          <section className="card overflow-x-auto !p-0">
            <h2 className="p-3 pb-0 text-sm font-bold text-navy">Payment history</h2>
            <table className="tbl"><thead><tr><th>Date</th><th>Purpose</th><th>Method</th><th>Amount</th><th>Status</th><th>Receipt</th></tr></thead>
              <tbody>{txns.filter((t) => t.status !== "created").map((t) => <tr key={t.id}><td>{formatDateTime(t.paidAt ?? t.createdAt)}</td><td>{t.purpose ?? label(t.kind)}</td><td>{label(t.method)}</td><td>{formatINR(t.amountPaise)}</td><td><StatusBadge status={t.status} /></td><td>{t.receiptNo ?? "—"}</td></tr>)}</tbody></table>
            {txns.filter((t) => t.status !== "created").length === 0 && <p className="p-3 text-sm text-slate-500">No payments yet.</p>}
            {cols.length > 0 && <><h3 className="px-3 pt-2 text-xs font-bold text-slate-500">Manual collections</h3><table className="tbl"><tbody>{cols.map((c) => <tr key={c.id}><td>{formatDateTime(c.createdAt)}</td><td>{label(c.purpose)}</td><td>{label(c.method)} {c.reference}</td><td>{formatINR(c.amountPaise)}</td><td><StatusBadge status={c.status} /></td></tr>)}</tbody></table></>}
          </section>

          {can(ctx, "collections", "create") && (
            <form action={recordCollectionAction} className="card grid gap-3 sm:grid-cols-5">
              <input type="hidden" name="memberId" value={m.id} /><input type="hidden" name="back" value={`/admin/members/${m.id}`} />
              <h2 className="text-sm font-bold text-navy sm:col-span-5">Record a fee collection (cash / UPI / bank)</h2>
              <Field label="Amount (₹)" name="amount" type="number" min={1} required />
              <Field label="Purpose" name="purpose" required options={[{ value: "application_fee", label: "Joining fee" }, { value: "renewal", label: "Renewal" }]} defaultValue={m.membershipNo ? "renewal" : "application_fee"} />
              <Field label="Method" name="method" required options={[{ value: "cash", label: "Cash" }, { value: "upi", label: "UPI" }, { value: "bank", label: "Bank" }]} />
              <Field label="Reference / UTR" name="reference" />
              <div className="flex items-end"><SubmitButton>Record</SubmitButton></div>
            </form>
          )}

          {welfare.length > 0 && <section className="card text-sm"><h2 className="mb-1 font-bold text-navy">Welfare history</h2>{welfare.map(({ w, s }) => <p key={w.id}>{w.refNo} — {s} <StatusBadge status={w.status} /></p>)}</section>}
          {audit.length > 0 && <section className="card text-xs"><h2 className="mb-1 text-sm font-bold text-navy">Audit history</h2>{audit.map((a) => <p key={a.id}>{formatDateTime(a.createdAt)} — {a.action}</p>)}</section>}
        </div>

        <div className="space-y-4">
          {card ? (
            <>
              <MembershipCard c={card.card} />
              <CardActions link={card.link} fileName={`R2M-card-${m.membershipNo}`} />
              <p className="text-center text-xs text-slate-500">Card status: {card.cardStatus}</p>
            </>
          ) : <section className="card text-sm text-slate-500">ID card is generated on approval.</section>}
          {can(ctx, "cards", "manage") && m.membershipNo && (
            <form action={cardAdminAction} className="card flex flex-wrap gap-2"><input type="hidden" name="id" value={m.id} />
              <button name="act" value="issue" className="btn btn-outline btn-sm">Generate card</button>
              <button name="act" value="reissue" className="btn btn-outline btn-sm">Reissue (new QR)</button></form>
          )}
          {m.membershipNo && (can(ctx, "members", "edit") || can(ctx, "members", "approve")) && (
            <form action={memberStatusAction} className="card space-y-2"><input type="hidden" name="id" value={m.id} />
              {m.status === "suspended" ? <button name="act" value="reactivate" className="btn btn-success btn-sm w-full">Reactivate membership</button> : (
                <><input name="reason" placeholder="Reason for suspension" className="input" /><button name="act" value="suspend" className="btn btn-danger btn-sm w-full">Suspend membership & card</button></>
              )}
            </form>
          )}
          {m.userId && canEdit && (
            <form action={resetLinkAction} className="card"><input type="hidden" name="userId" value={m.userId} /><input type="hidden" name="back" value={`/admin/members/${m.id}`} />
              <SubmitButton className="btn-outline btn-sm w-full">Generate password reset link</SubmitButton></form>
          )}
          <section className="card text-sm"><h2 className="mb-1 font-bold text-navy">Documents</h2>
            {docs.length === 0 ? <p className="text-slate-500">None uploaded.</p> : docs.map((d) => <p key={d.id}><a className="link" target="_blank" href={`/api/files/${d.fileName}`}>{label(d.docType)}</a> <span className="text-xs text-slate-400">{d.originalName}</span></p>)}
          </section>
          {hist.length > 0 && <section className="card text-xs"><h2 className="mb-1 text-sm font-bold text-navy">Card history</h2>{hist.map((h) => <p key={h.id}>{formatDateTime(h.createdAt)} — {h.action} {h.note && `(${h.note})`}</p>)}</section>}
        </div>
      </div>
      <span className="hidden">{toDateInput(null)}</span>
    </>
  );
}
