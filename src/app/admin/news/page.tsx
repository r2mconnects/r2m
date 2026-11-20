import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { news } from "@/db/schema";
import { newsStatusAction, saveNewsAction } from "@/actions/content.actions";
import { Checkbox, Field } from "@/components/forms/Field";
import { GeoSelect, SubmitButton } from "@/components/forms/controls";
import { EmptyState, Flash, PageHeader, StatusBadge } from "@/components/shared/ui";
import { NEWS_CATEGORIES } from "@/constants/status";
import { can, requirePermission } from "@/lib/auth/session";
import { getDistricts, getMandals } from "@/lib/data/geo";
import { formatDateTime } from "@/lib/utils";

export const metadata = { title: "News" };

export default async function NewsAdmin({ searchParams }: { searchParams: Promise<{ new?: string; edit?: string; msg?: string; err?: string }> }) {
  const sp = await searchParams;
  const ctx = await requirePermission("news", "view");
  const list = await db.select().from(news).orderBy(desc(news.publishAt)).limit(100);
  const [ds, ms] = await Promise.all([getDistricts(), getMandals()]);
  const editing = sp.edit ? list.find((n) => n.id === sp.edit) : undefined;
  const showForm = (sp.new && can(ctx, "news", "create")) || (editing && can(ctx, "news", "edit"));
  const aD = ctx.scope.global ? ds : ds.filter((d) => ctx.scope.districtIds.includes(d.id));
  const aM = ctx.scope.global ? ms : ms.filter((m) => ctx.scope.districtIds.includes(m.districtId) || ctx.scope.mandalIds.includes(m.id));
  return (
    <>
      <PageHeader title="News & Announcements" crumbs={[{ label: "News" }]} actions={can(ctx, "news", "create") ? <Link href="/admin/news?new=1" className="btn btn-primary btn-sm">+ Publish news</Link> : undefined} />
      <Flash sp={sp} />
      {showForm && (
        <form action={saveNewsAction} className="card mb-4 grid gap-3 sm:grid-cols-2">
          {editing && <input type="hidden" name="id" value={editing.id} />}
          <h2 className="text-sm font-bold text-navy sm:col-span-2">{editing ? "Edit news" : "New news / notice"}</h2>
          <Field label="Title" name="title" required defaultValue={editing?.title} className="sm:col-span-2" />
          <Field label="Short description" name="summary" defaultValue={editing?.summary} className="sm:col-span-2" />
          <Field label="Content" name="body" rows={6} required defaultValue={editing?.body} className="sm:col-span-2" />
          <Field label="Category" name="category" required defaultValue={editing?.category ?? "general"} options={Object.entries(NEWS_CATEGORIES).map(([value, label]) => ({ value, label }))} />
          <Field label="Status" name="status" required defaultValue={editing?.status ?? "published"} options={[{ value: "published", label: "Published" }, { value: "draft", label: "Draft" }, { value: "unpublished", label: "Unpublished" }]} />
          <Field label="Publish at (schedule)" name="publishAt" type="datetime-local" hint="Leave blank to publish now. Future dates stay hidden until then." />
          <GeoSelect districts={aD} mandals={aM} districtId={editing?.districtId} mandalId={editing?.mandalId} required={false} optional />
          <Field label="Cover image" name="image" type="file" accept="image/*" />
          <Field label="Attachment (PDF / image)" name="attachment" type="file" accept="image/*,application/pdf" />
          <Checkbox name="isNotice" label="Official formal notice" defaultChecked={editing?.isNotice} />
          {!editing && <Checkbox name="notify" label="Send in-app notification to the audience" defaultChecked />}
          <div className="sm:col-span-2"><SubmitButton>Save</SubmitButton></div>
        </form>
      )}
      {list.length === 0 ? <EmptyState title="No news published" /> : (
        <div className="card overflow-x-auto !p-0"><table className="tbl"><thead><tr><th>Title</th><th>Category</th><th>Publish</th><th>Status</th><th></th></tr></thead>
          <tbody>{list.map((n) => (
            <tr key={n.id}><td className="font-semibold">{n.title}{n.isNotice && <span className="ml-1 text-[10px] text-amber-700">NOTICE</span>}</td><td>{NEWS_CATEGORIES[n.category]}</td><td>{formatDateTime(n.publishAt)}</td><td><StatusBadge status={n.status} /></td>
              <td><form action={newsStatusAction} className="flex gap-1"><input type="hidden" name="id" value={n.id} />
                {can(ctx, "news", "edit") && <Link href={`/admin/news?edit=${n.id}`} className="btn btn-outline btn-sm">Edit</Link>}
                {can(ctx, "news", "edit") && (n.status === "published" ? <button name="act" value="unpublish" className="btn btn-outline btn-sm">Unpublish</button> : <button name="act" value="publish" className="btn btn-outline btn-sm">Publish</button>)}
                {can(ctx, "news", "delete") && <SubmitButton className="btn-danger btn-sm" confirm="Delete this news item permanently?">Delete</SubmitButton>}
              </form></td></tr>))}</tbody></table></div>
      )}
    </>
  );
}
