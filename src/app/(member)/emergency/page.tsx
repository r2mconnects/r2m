import { desc, eq, or, isNull } from "drizzle-orm";
import { Phone, Siren } from "lucide-react";
import { db } from "@/db";
import { emergencyContacts, emergencyRequests, users } from "@/db/schema";
import { sosAction } from "@/actions/member.actions";
import { SubmitButton } from "@/components/forms/controls";
import { SosLocation } from "@/components/shared/SosLocation";
import { EmptyState, Flash, PageHeader, StatusBadge } from "@/components/shared/ui";
import { requireMember } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/utils";

export const metadata = { title: "Emergency" };

export default async function EmergencyPage({ searchParams }: { searchParams: Promise<{ msg?: string; err?: string }> }) {
  const sp = await searchParams;
  const { member } = await requireMember();
  const [contacts, reqs] = await Promise.all([
    db.select().from(emergencyContacts).where(or(isNull(emergencyContacts.districtId), eq(emergencyContacts.districtId, member.districtId ?? "00000000-0000-0000-0000-000000000000"))),
    db
      .select({ r: emergencyRequests, coordinator: users.fullName })
      .from(emergencyRequests)
      .leftJoin(users, eq(users.id, emergencyRequests.assignedTo))
      .where(eq(emergencyRequests.memberId, member.id))
      .orderBy(desc(emergencyRequests.createdAt)),
  ]);
  const active = contacts.filter((c) => c.active);
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Emergency Assistance" crumbs={[{ label: "Member", href: "/member" }, { label: "Emergency" }]} />
      <Flash sp={sp} />
      <section className="mb-4">
        <h2 className="mb-2 text-sm font-bold text-navy">Emergency contacts</h2>
        {active.length === 0 ? <EmptyState title="No emergency contacts configured" hint="The association office has not added emergency numbers yet. For life-threatening emergencies call 112." action={<a href="tel:112" className="btn btn-danger btn-sm"><Phone size={14} /> Call 112</a>} /> : (
          <div className="grid gap-2 sm:grid-cols-2">
            {active.map((c) => (
              <a key={c.id} href={`tel:${c.phone}`} className="card flex items-center justify-between !p-3 hover:border-royal">
                <span><span className="block text-sm font-semibold text-navy">{c.label}</span><span className="text-xs text-slate-500">{c.kind} • {c.phone}</span></span>
                <span className="btn btn-danger btn-sm"><Phone size={14} /> Call</span>
              </a>
            ))}
          </div>
        )}
      </section>
      <section className="card mb-4 border-red-200">
        <h2 className="mb-1 flex items-center gap-2 text-sm font-bold text-red-700"><Siren size={18} /> Send SOS request to association</h2>
        <p className="mb-2 text-xs text-slate-600">An SOS request alerts association coordinators. It is <b>not</b> a confirmed emergency response — you will see its status below once someone acknowledges it. In immediate danger, call the numbers above.</p>
        <form action={sosAction} className="space-y-2">
          <textarea name="message" rows={2} className="input" placeholder="What happened? Where are you?" required />
          <SosLocation />
          <SubmitButton className="btn-danger w-full" confirm="Send SOS request to association coordinators?">Send SOS request</SubmitButton>
        </form>
      </section>
      <h2 className="mb-2 text-sm font-bold text-navy">My request history</h2>
      {reqs.length === 0 ? <EmptyState title="No SOS requests" /> : (
        <div className="space-y-2">
          {reqs.map(({ r, coordinator }) => (
            <div key={r.id} className="card !p-3 text-sm">
              <div className="flex items-center justify-between"><span className="text-xs text-slate-500">{formatDateTime(r.createdAt)}</span><StatusBadge status={r.status} /></div>
              <p>{r.message}</p>
              <p className="text-xs text-slate-500">{r.status === "submitted" ? "Submitted — waiting for acknowledgement (not yet a confirmed response)." : `Coordinator: ${coordinator ?? "Assigned"}${r.responseNote ? ` • ${r.responseNote}` : ""}`}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
