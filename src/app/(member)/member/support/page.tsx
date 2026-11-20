import { desc, eq } from "drizzle-orm";
import { Mail, Phone } from "lucide-react";
import { db } from "@/db";
import { supportTickets } from "@/db/schema";
import { createTicketAction } from "@/actions/member.actions";
import { Field } from "@/components/forms/Field";
import { SubmitButton } from "@/components/forms/controls";
import { EmptyState, Flash, PageHeader, StatusBadge } from "@/components/shared/ui";
import { requireUser } from "@/lib/auth/session";
import { getSettings } from "@/lib/settings";
import { formatDateTime } from "@/lib/utils";

export const metadata = { title: "Help & support" };

export default async function SupportPage({ searchParams }: { searchParams: Promise<{ msg?: string; err?: string }> }) {
  const sp = await searchParams;
  const ctx = await requireUser();
  const s = await getSettings();
  const tickets = await db.select().from(supportTickets).where(eq(supportTickets.userId, ctx.user.id)).orderBy(desc(supportTickets.createdAt));
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PageHeader title="Help & Support" crumbs={[{ label: "Member", href: "/member" }, { label: "Support" }]} />
      <Flash sp={sp} />
      <section className="card flex flex-wrap gap-4 text-sm">
        {s.contactPhone ? <a href={`tel:${s.contactPhone}`} className="flex items-center gap-2 link"><Phone size={16} /> {s.contactPhone}</a> : <span className="text-slate-500">Office phone not configured yet.</span>}
        {s.contactEmail && <a href={`mailto:${s.contactEmail}`} className="flex items-center gap-2 link"><Mail size={16} /> {s.contactEmail}</a>}
      </section>
      <form action={createTicketAction} className="card space-y-3">
        <h2 className="text-sm font-bold text-navy">Raise a request</h2>
        <Field label="Subject" name="subject" required />
        <Field label="Message" name="message" rows={3} required />
        <SubmitButton>Submit</SubmitButton>
      </form>
      <h2 className="text-sm font-bold text-navy">My requests</h2>
      {tickets.length === 0 ? <EmptyState title="No requests yet" /> : tickets.map((t) => (
        <div key={t.id} className="card !p-3 text-sm">
          <div className="flex justify-between"><b>{t.subject}</b><StatusBadge status={t.status} /></div>
          <p className="text-xs text-slate-500">{formatDateTime(t.createdAt)}</p>
          <p className="mt-1">{t.message}</p>
          {t.reply && <p className="mt-2 rounded-lg bg-blue-50 p-2"><b>Reply:</b> {t.reply}</p>}
        </div>
      ))}
    </div>
  );
}
