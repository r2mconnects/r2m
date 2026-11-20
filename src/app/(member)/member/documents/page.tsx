import { desc, eq } from "drizzle-orm";
import { FileText } from "lucide-react";
import { db } from "@/db";
import { memberDocuments } from "@/db/schema";
import { uploadDocumentAction } from "@/actions/member.actions";
import { Field } from "@/components/forms/Field";
import { SubmitButton } from "@/components/forms/controls";
import { EmptyState, Flash, PageHeader } from "@/components/shared/ui";
import { requireMember } from "@/lib/auth/session";
import { formatDateTime, label } from "@/lib/utils";

export const metadata = { title: "My documents" };

export default async function DocumentsPage({ searchParams }: { searchParams: Promise<{ msg?: string; err?: string }> }) {
  const sp = await searchParams;
  const { member } = await requireMember();
  const docs = await db.select().from(memberDocuments).where(eq(memberDocuments.memberId, member.id)).orderBy(desc(memberDocuments.createdAt));
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="My Documents" subtitle="Stored privately. Only you and authorized staff can open them." crumbs={[{ label: "Member", href: "/member" }, { label: "Documents" }]} />
      <Flash sp={sp} />
      <form action={uploadDocumentAction} className="card mb-4 grid gap-3 sm:grid-cols-2">
        <Field label="Document type" name="docType" required options={[{ value: "id_proof", label: "ID proof" }, { value: "address_proof", label: "Address proof" }, { value: "workshop", label: "Workshop proof" }, { value: "other", label: "Other" }]} />
        <Field label="File (image or PDF, max 5 MB)" name="file" type="file" required accept="image/*,application/pdf" />
        <div className="sm:col-span-2"><SubmitButton>Upload</SubmitButton></div>
      </form>
      {docs.length === 0 ? <EmptyState title="No documents uploaded" /> : (
        <div className="card divide-y !p-0">
          {docs.map((d) => (
            <a key={d.id} target="_blank" href={`/api/files/${d.fileName}`} className="flex items-center gap-3 p-3 text-sm hover:bg-slate-50">
              <FileText className="text-royal" size={20} />
              <span className="flex-1"><span className="block font-semibold">{label(d.docType)}</span><span className="text-xs text-slate-500">{d.originalName} • {formatDateTime(d.createdAt)}</span></span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
