import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { welfareApplications, welfareApprovals, welfareDisbursements, welfareSchemes } from "@/db/schema";
import { Flash, PageHeader, StatusBadge } from "@/components/shared/ui";
import { requireMember } from "@/lib/auth/session";
import { WELFARE_STATUS_LABEL } from "@/constants/status";
import { formatDateTime, formatINR, label } from "@/lib/utils";

export default async function WelfareDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ msg?: string; err?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const { member } = await requireMember();
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const [row] = await db
    .select({ w: welfareApplications, scheme: welfareSchemes.name })
    .from(welfareApplications)
    .innerJoin(welfareSchemes, eq(welfareSchemes.id, welfareApplications.schemeId))
    .where(and(eq(welfareApplications.id, id), eq(welfareApplications.memberId, member.id)));
  if (!row) notFound();
  const { w } = row;
  const hist = await db.select().from(welfareApprovals).where(eq(welfareApprovals.applicationId, id)).orderBy(asc(welfareApprovals.createdAt));
  const [disb] = await db.select().from(welfareDisbursements).where(eq(welfareDisbursements.applicationId, id));
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title={`${row.scheme}`} subtitle={w.refNo} crumbs={[{ label: "Welfare", href: "/welfare" }, { label: w.refNo }]} />
      <Flash sp={sp} />
      <section className="card space-y-2 text-sm">
        <p><b>Status:</b> <StatusBadge status={w.status} text={WELFARE_STATUS_LABEL[w.status]} /> {w.status !== "rejected" && w.currentStage !== "done" && <span className="text-xs text-slate-500">• Current stage: {label(w.currentStage)}</span>}</p>
        <p><b>Reason:</b> {w.reason}</p>
        {w.description && <p className="whitespace-pre-wrap">{w.description}</p>}
        <p><b>Requested:</b> {w.requestedPaise ? formatINR(w.requestedPaise) : "—"} {w.approvedPaise ? <> • <b>Approved:</b> {formatINR(w.approvedPaise)}</> : null}</p>
        {w.decisionReason && <p className="rounded-lg bg-slate-50 p-2"><b>Latest note:</b> {w.decisionReason}</p>}
        {disb && <p className="rounded-lg bg-green-50 p-2 text-green-800">Disbursed {formatINR(disb.amountPaise)} on {formatDateTime(disb.createdAt)} ({label(disb.method)}{disb.reference ? ` • ${disb.reference}` : ""})</p>}
        {w.documents.length > 0 && (
          <div><b>Documents:</b><ul className="list-disc pl-5">{w.documents.map((d) => <li key={d.file}><a className="link" target="_blank" href={`/api/files/${d.file}`}>{d.name}</a></li>)}</ul></div>
        )}
      </section>
      <h2 className="mb-2 mt-4 text-sm font-bold text-navy">History</h2>
      <ol className="card space-y-2 text-sm">
        <li>Submitted — {formatDateTime(w.createdAt)}</li>
        {hist.map((h) => <li key={h.id}>{label(h.stage)}: <b>{label(h.decision)}</b> — {formatDateTime(h.createdAt)}{h.comment && <span className="text-slate-600"> • {h.comment}</span>}</li>)}
      </ol>
    </div>
  );
}
