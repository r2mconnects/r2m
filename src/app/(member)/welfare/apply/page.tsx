import { eq } from "drizzle-orm";
import { db } from "@/db";
import { welfareSchemes } from "@/db/schema";
import { applyWelfareAction } from "@/actions/welfare.actions";
import { Checkbox, Field } from "@/components/forms/Field";
import { SubmitButton } from "@/components/forms/controls";
import { Flash, PageHeader } from "@/components/shared/ui";
import { requireMember } from "@/lib/auth/session";

export const metadata = { title: "Apply for welfare" };

export default async function ApplyPage({ searchParams }: { searchParams: Promise<{ msg?: string; err?: string }> }) {
  const sp = await searchParams;
  const { member } = await requireMember();
  const schemes = await db.select().from(welfareSchemes).where(eq(welfareSchemes.active, true));
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Welfare Application" crumbs={[{ label: "Welfare", href: "/welfare" }, { label: "Apply" }]} />
      <Flash sp={sp} />
      {member.status !== "active" && <p className="mb-3 rounded-lg bg-amber-50 p-2 text-sm text-amber-800">Welfare applications are open to active members only.</p>}
      <form action={applyWelfareAction} className="card space-y-3">
        <Field label="Welfare scheme" name="schemeId" required options={[{ value: "", label: "Select scheme" }, ...schemes.map((s) => ({ value: s.id, label: s.name }))]} />
        <Field label="Reason for application" name="reason" required rows={2} />
        <Field label="Detailed description" name="description" rows={4} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Requested amount (₹)" name="requested" type="number" min={0} step="1" />
          <Field label="Emergency contact (name & phone)" name="emergencyContact" defaultValue={member.emergencyName ? `${member.emergencyName} ${member.emergencyPhone ?? ""}` : ""} />
        </div>
        <Field label="Supporting documents (images / PDF, up to 5 MB each)" name="docs" type="file" multiple accept="image/*,application/pdf" hint="Hold Ctrl/Cmd to select multiple files. Stored privately." />
        <Checkbox name="consent" label="I confirm the information is true and consent to its verification by the association." />
        <SubmitButton>Submit application</SubmitButton>
      </form>
    </div>
  );
}
