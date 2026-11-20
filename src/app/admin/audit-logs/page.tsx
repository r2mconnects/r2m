import { desc, eq, ilike } from "drizzle-orm";
import { db } from "@/db";
import { auditLogs, users } from "@/db/schema";
import { EmptyState, PageHeader } from "@/components/shared/ui";
import { requirePermission } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/utils";

export const metadata = { title: "Audit logs" };

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  await requirePermission("audit", "view");
  const rows = await db
    .select({ a: auditLogs, who: users.fullName })
    .from(auditLogs)
    .leftJoin(users, eq(users.id, auditLogs.userId))
    .where(q ? ilike(auditLogs.action, `%${q}%`) : undefined)
    .orderBy(desc(auditLogs.createdAt))
    .limit(200);
  return (
    <>
      <PageHeader title="Audit Logs" subtitle="Administrative, financial and approval actions" crumbs={[{ label: "Audit Logs" }]} />
      <form className="mb-3 flex gap-2"><input name="q" defaultValue={q} placeholder="Filter by action e.g. payment, welfare, staff" className="input max-w-sm" /><button className="btn btn-outline btn-sm">Filter</button></form>
      {rows.length === 0 ? <EmptyState title="No log entries" /> : (
        <div className="card overflow-x-auto !p-0"><table className="tbl"><thead><tr><th>When</th><th>User</th><th>Action</th><th>Entity</th><th>Details</th></tr></thead>
          <tbody>{rows.map(({ a, who }) => <tr key={a.id}><td className="whitespace-nowrap">{formatDateTime(a.createdAt)}</td><td>{who ?? "—"}</td><td className="font-mono text-xs">{a.action}</td><td className="text-xs">{a.entity} {a.entityId?.slice(0, 8)}</td><td className="max-w-xs truncate text-xs text-slate-500">{a.details ? JSON.stringify(a.details) : ""}</td></tr>)}</tbody></table></div>
      )}
    </>
  );
}
