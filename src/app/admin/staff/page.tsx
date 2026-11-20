import Link from "next/link";
import { desc, eq, ne, and, inArray } from "drizzle-orm";
import { Eye } from "lucide-react";
import { db } from "@/db";
import { districts, mandals, roles, userRoles, users } from "@/db/schema";
import { EmptyState, Flash, PageHeader, StatusBadge } from "@/components/shared/ui";
import { can, requirePermission } from "@/lib/auth/session";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Staff" };

export default async function StaffPage({ searchParams }: { searchParams: Promise<{ role?: string; msg?: string; err?: string }> }) {
  const sp = await searchParams;
  const ctx = await requirePermission("staff", "view");
  const conds = [ne(userRoles.roleKey, "member")];
  if (sp.role) conds.push(eq(userRoles.roleKey, sp.role));
  if (!ctx.scope.global) {
    // Non-global staff see only people under their own level in their own area.
    const lower = (await db.select().from(roles)).filter((r) => r.level > ctx.minLevel && r.key !== "member").map((r) => r.key);
    conds.push(inArray(userRoles.roleKey, lower.length ? lower : ["__none__"]));
  }
  const rows = await db
    .select({ ur: userRoles, u: users, role: roles.name, d: districts.name, m: mandals.name })
    .from(userRoles)
    .innerJoin(users, eq(users.id, userRoles.userId))
    .innerJoin(roles, eq(roles.key, userRoles.roleKey))
    .leftJoin(districts, eq(districts.id, userRoles.districtId))
    .leftJoin(mandals, eq(mandals.id, userRoles.mandalId))
    .where(and(...conds))
    .orderBy(desc(userRoles.createdAt));
  const visible = ctx.scope.global ? rows : rows.filter((r) => (r.ur.districtId && ctx.scope.districtIds.includes(r.ur.districtId)) || (r.ur.mandalId && ctx.scope.mandalIds.includes(r.ur.mandalId)));
  const allRoles = await db.select().from(roles);
  return (
    <>
      <PageHeader title="Staff & Roles Management" crumbs={[{ label: "Staff" }, { label: "Staff / Employees" }]} actions={can(ctx, "staff", "create") ? <Link href="/admin/staff/new" className="btn btn-primary btn-sm">+ Add Staff</Link> : undefined} />
      <Flash sp={sp} />
      <form className="mb-3 flex gap-2"><select name="role" defaultValue={sp.role ?? ""} className="input max-w-56"><option value="">All roles</option>{allRoles.filter((r) => r.key !== "member").map((r) => <option key={r.key} value={r.key}>{r.name}</option>)}</select><button className="btn btn-outline btn-sm">Filter</button></form>
      {visible.length === 0 ? <EmptyState title="No staff accounts" hint="Add district presidents, mandal representatives, agents and officers." /> : (
        <div className="card overflow-x-auto !p-0">
          <table className="tbl"><thead><tr><th>Name</th><th>Role</th><th>District / Mandal</th><th>Mobile</th><th>Joined</th><th>Status</th><th></th></tr></thead>
            <tbody>{visible.map(({ ur, u, role, d, m }) => (
              <tr key={ur.id}><td className="font-semibold">{u.fullName}<span className="block text-[11px] font-normal text-slate-500">{ur.employeeId}</span></td><td>{role}</td><td>{[d, m].filter(Boolean).join(" / ") || "All"}</td><td>{u.mobile}</td><td>{formatDate(ur.joiningDate)}</td><td><StatusBadge status={u.status === "active" && !ur.active ? "suspended" : u.status} /></td><td><Link href={`/admin/staff/${u.id}`} className="btn btn-outline btn-sm" aria-label="View"><Eye size={14} /></Link></td></tr>
            ))}</tbody></table>
        </div>
      )}
    </>
  );
}
