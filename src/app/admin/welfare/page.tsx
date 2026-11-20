import Link from "next/link";
import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { districts, members, welfareApplications, welfareApprovals, welfareDisbursements, welfareSchemes } from "@/db/schema";
import { approveWelfareAction, closeWelfareAction, disburseWelfareAction, reviewWelfareAction, saveSchemeAction } from "@/actions/welfare.actions";
import { Field } from "@/components/forms/Field";
import { SubmitButton } from "@/components/forms/controls";
import { EmptyState, Flash, PageHeader, StatusBadge, Tabs } from "@/components/shared/ui";
import { WELFARE_STATUS_LABEL } from "@/constants/status";
import { can, requirePermission } from "@/lib/auth/session";
import { memberScope } from "@/lib/scope";
import { formatDate, formatDateTime, formatINR, label } from "@/lib/utils";

export const metadata = { title: "Welfare" };

export default async function WelfareAdmin({ searchParams }: { searchParams: Promise<{ tab?: string; open?: string; msg?: string; err?: string }> }) {
  const sp = await searchParams;
  const ctx = await requirePermission("welfare", "view");
  const tab = sp.tab ?? "applications";
  const schemes = await db.select().from(welfareSchemes).orderBy(asc(welfareSchemes.name));
  const apps = await db
    .select({ w: welfareApplications, scheme: welfareSchemes.name, m: members, d: districts.name })
    .from(welfareApplications)
    .innerJoin(welfareSchemes, eq(welfareSchemes.id, welfareApplications.schemeId))
    .innerJoin(members, eq(members.id, welfareApplications.memberId))
    .leftJoin(districts, eq(districts.id, members.districtId))
    .where(and(memberScope(ctx)))
    .orderBy(desc(welfareApplications.createdAt))
    .limit(200);
  const open = sp.open ? apps.find((a) => a.w.id === sp.open) : undefined;
  const hist = open ? await db.select().from(welfareApprovals).where(eq(welfareApprovals.applicationId, open.w.id)).orderBy(asc(welfareApprovals.createdAt)) : [];
  const disb = tab === "disbursements" && can(ctx, "disbursements", "view")
    ? await db.select({ d: welfareDisbursements, w: welfareApplications.refNo, who: members.fullName }).from(welfareDisbursements).innerJoin(welfareApplications, eq(welfareApplications.id, welfareDisbursements.applicationId)).innerJoin(members, eq(members.id, welfareApplications.memberId)).orderBy(desc(welfareDisbursements.createdAt))
    : [];
  const edit = can(ctx, "welfare", "edit");
  return (
    <>
      <PageHeader title="Welfare Management" crumbs={[{ label: "Welfare" }]} />
      <Flash sp={sp} />
      <Tabs active={tab} base="/admin/welfare" tabs={[{ key: "applications", label: "Applications", count: apps.length }, { key: "schemes", label: "Schemes" }, ...(can(ctx, "disbursements", "view") ? [{ key: "disbursements", label: "Disbursements" }] : [])]} />
      {tab === "applications" && (
        <>
          {open && (
            <section className="card mb-4 space-y-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-bold text-navy">{open.w.refNo} — {open.scheme} <StatusBadge status={open.w.status} text={WELFARE_STATUS_LABEL[open.w.status]} /></h2><Link href={`/admin/members/${open.m.id}`} className="link text-xs">Member: {open.m.fullName}</Link></div>
              <p><b>Reason:</b> {open.w.reason}</p>{open.w.description && <p className="whitespace-pre-wrap">{open.w.description}</p>}
              <p><b>Requested:</b> {open.w.requestedPaise ? formatINR(open.w.requestedPaise) : "—"} • <b>Approved:</b> {open.w.approvedPaise ? formatINR(open.w.approvedPaise) : "—"} • <b>Stage:</b> {label(open.w.currentStage)}</p>
              {open.w.documents.length > 0 && <p><b>Documents:</b> {open.w.documents.map((d) => <a key={d.file} target="_blank" className="link mr-3" href={`/api/files/${d.file}`}>{d.name}</a>)}</p>}
              <ol className="list-decimal space-y-0.5 pl-5 text-xs">{hist.map((h) => <li key={h.id}>{label(h.stage)} — <b>{label(h.decision)}</b> {formatDateTime(h.createdAt)} {h.comment && `• ${h.comment}`}</li>)}</ol>
              {edit && ["submitted", "under_review", "more_info", "recommended"].includes(open.w.status) && open.w.currentStage !== "finance" && (
                <form action={reviewWelfareAction} className="flex flex-wrap items-center gap-2 border-t pt-3"><input type="hidden" name="id" value={open.w.id} />
                  <input name="comment" placeholder="Comment / reason" className="input max-w-72" />
                  {open.w.currentStage !== "committee" && <button name="decision" value="recommend" className="btn btn-success btn-sm">Recommend → next stage</button>}
                  <button name="decision" value="more_info" className="btn btn-outline btn-sm">Request more info</button><button name="decision" value="reject" className="btn btn-danger btn-sm">Reject</button></form>
              )}
              {can(ctx, "welfare", "approve") && open.w.status === "recommended" && open.w.currentStage === "committee" && (
                <form action={approveWelfareAction} className="flex flex-wrap items-center gap-2 border-t pt-3"><input type="hidden" name="id" value={open.w.id} />
                  <input name="amount" type="number" min={0} placeholder="Approved amount ₹" defaultValue={open.w.requestedPaise ? open.w.requestedPaise / 100 : undefined} className="input max-w-44" /><input name="comment" placeholder="Committee note" className="input max-w-64" /><SubmitButton confirm="Record committee approval?">Committee approve</SubmitButton></form>
              )}
              {can(ctx, "disbursements", "manage") && open.w.status === "payment_pending" && (
                <form action={disburseWelfareAction} className="flex flex-wrap items-center gap-2 border-t pt-3"><input type="hidden" name="id" value={open.w.id} />
                  <input name="amount" type="number" min={1} defaultValue={(open.w.approvedPaise ?? 0) / 100} className="input max-w-36" /><select name="method" className="input max-w-32"><option value="bank">Bank</option><option value="upi">UPI</option><option value="cash">Cash</option></select><input name="reference" placeholder="Reference / UTR" className="input max-w-48" /><SubmitButton confirm="Record disbursement? This is a financial action and is audited.">Record disbursement</SubmitButton></form>
              )}
              {edit && open.w.status === "disbursed" && <form action={closeWelfareAction}><input type="hidden" name="id" value={open.w.id} /><SubmitButton className="btn-outline btn-sm">Close application</SubmitButton></form>}
            </section>
          )}
          {apps.length === 0 ? <EmptyState title="No welfare applications" /> : (
            <div className="card overflow-x-auto !p-0"><table className="tbl"><thead><tr><th>Ref</th><th>Member</th><th>Scheme</th><th>District</th><th>Amount</th><th>Stage</th><th>Status</th><th></th></tr></thead>
              <tbody>{apps.map(({ w, scheme, m, d }) => <tr key={w.id}><td>{w.refNo}</td><td>{m.fullName}</td><td>{scheme}</td><td>{d}</td><td>{w.requestedPaise ? formatINR(w.requestedPaise) : "—"}</td><td>{label(w.currentStage)}</td><td><StatusBadge status={w.status} text={WELFARE_STATUS_LABEL[w.status]} /></td><td><Link className="btn btn-outline btn-sm" href={`/admin/welfare?tab=applications&open=${w.id}`}>Open</Link></td></tr>)}</tbody></table></div>
          )}
        </>
      )}
      {tab === "schemes" && (
        <div className="space-y-3">
          {[...schemes, null].map((s) => (!s && !can(ctx, "welfare", "manage")) ? null : (
            <form key={s?.id ?? "new"} action={saveSchemeAction} className="card grid gap-3 sm:grid-cols-4">
              {s && <input type="hidden" name="id" value={s.id} />}
              <Field label={s ? "Scheme" : "New scheme"} name="name" required defaultValue={s?.name} className="sm:col-span-2" />
              <Field label="Category" name="category" defaultValue={s?.category} />
              <Field label="Max amount (₹)" name="max" type="number" min={0} defaultValue={s?.maxAmountPaise ? s.maxAmountPaise / 100 : undefined} />
              <Field label="Description" name="description" defaultValue={s?.description} className="sm:col-span-4" />
              <div className="flex flex-wrap items-center gap-4 text-sm sm:col-span-4"><b className="text-xs text-slate-500">Review levels:</b>
                {(["mandal", "district", "welfare_officer"] as const).map((l) => <label key={l} className="flex items-center gap-1"><input type="checkbox" name={`lvl_${l}`} defaultChecked={s?.approvalLevels.includes(l)} /> {label(l)}</label>)}
                <label className="flex items-center gap-1"><input type="checkbox" name="active" defaultChecked={s?.active ?? true} /> Active</label>
                {can(ctx, "welfare", "manage") && <SubmitButton className="btn-outline btn-sm">{s ? "Save" : "Add scheme"}</SubmitButton>}</div>
            </form>))}
          <p className="text-xs text-slate-500">After the selected review levels, every application goes to committee approval, then finance disbursement (separate permissions).</p>
        </div>
      )}
      {tab === "disbursements" && (disb.length === 0 ? <EmptyState title="No disbursements yet" /> : <div className="card overflow-x-auto !p-0"><table className="tbl"><thead><tr><th>Date</th><th>Application</th><th>Member</th><th>Amount</th><th>Method</th><th>Reference</th></tr></thead><tbody>{disb.map(({ d, w, who }) => <tr key={d.id}><td>{formatDate(d.createdAt)}</td><td>{w}</td><td>{who}</td><td>{formatINR(d.amountPaise)}</td><td>{label(d.method)}</td><td>{d.reference}</td></tr>)}</tbody></table></div>)}
    </>
  );
}
