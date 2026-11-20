import { notFound } from "next/navigation";
import { asc, desc, eq, ne, count, and, sql } from "drizzle-orm";
import { db } from "@/db";
import { auditLogs, districts, manualCollections, mandals, members, roles, sessions, userRoles, users } from "@/db/schema";
import { resetLinkAction } from "@/actions/membership.actions";
import { revokeSessionsAction, setUserStatusAction, updateStaffRoleAction } from "@/actions/staff.actions";
import { Field } from "@/components/forms/Field";
import { GeoSelect, SubmitButton } from "@/components/forms/controls";
import { Avatar, Flash, PageHeader, StatusBadge } from "@/components/shared/ui";
import { requirePermission } from "@/lib/auth/session";
import { getDistricts, getMandals } from "@/lib/data/geo";
import { getSettings } from "@/lib/settings";
import { appOrigin, formatDate, formatDateTime, formatINR, toDateInput } from "@/lib/utils";

export default async function StaffDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ msg?: string; err?: string; act?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const ctx = await requirePermission("staff", "view");
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const [u] = await db.select().from(users).where(eq(users.id, id));
  if (!u) notFound();
  const assignments = await db
    .select({ ur: userRoles, role: roles })
    .from(userRoles)
    .innerJoin(roles, eq(roles.key, userRoles.roleKey))
    .where(and(eq(userRoles.userId, id), ne(userRoles.roleKey, "member")));
  if (assignments.length === 0) notFound();
  if (!ctx.scope.global && !assignments.some(({ ur }) => (ur.districtId && ctx.scope.districtIds.includes(ur.districtId)) || (ur.mandalId && ctx.scope.mandalIds.includes(ur.mandalId)))) notFound();
  const [allRoles, ds, ms, officers, s] = await Promise.all([
    db.select().from(roles).where(ne(roles.key, "member")).orderBy(asc(roles.level)),
    getDistricts(), getMandals(),
    db.select({ id: users.id, name: users.fullName }).from(userRoles).innerJoin(users, eq(users.id, userRoles.userId)).where(ne(userRoles.roleKey, "member")),
    getSettings(),
  ]);
  const [sess] = await db.select({ n: count() }).from(sessions).where(eq(sessions.userId, id));
  const activity = await db.select().from(auditLogs).where(eq(auditLogs.userId, id)).orderBy(desc(auditLogs.createdAt)).limit(25);
  const isAgent = assignments.some((a) => a.ur.roleKey === "agent");
  const [reg] = await db.select({ total: count(), active: sql<number>`count(*) filter (where ${members.status} = 'active')::int`, pending: sql<number>`count(*) filter (where ${members.status} in ('pending','under_review'))::int` }).from(members).where(eq(members.agentId, id));
  const [col] = await db.select({ total: sql<number>`coalesce(sum(${manualCollections.amountPaise}),0)::int`, verified: sql<number>`coalesce(sum(${manualCollections.amountPaise}) filter (where ${manualCollections.status} = 'verified'),0)::int`, pending: sql<number>`count(*) filter (where ${manualCollections.status} = 'pending')::int` }).from(manualCollections).where(eq(manualCollections.collectedBy, id));
  const origin = await appOrigin();
  const self = id === ctx.user.id;
  return (
    <>
      <PageHeader title={u.fullName} subtitle={`${u.mobile ?? ""} ${u.email ?? ""}`} crumbs={[{ label: "Staff", href: "/admin/staff" }, { label: u.fullName }]} actions={<StatusBadge status={u.status} />} />
      <Flash sp={sp} />
      {sp.act && <div className="mb-4 break-all rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm"><b>One-time activation / reset link:</b> {origin}/reset-password?token={sp.act}<p className="text-xs text-slate-500">Shown once. The staff member sets their own password with it.</p></div>}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {assignments.map(({ ur, role }) => (
            <form key={ur.id} action={updateStaffRoleAction} className="card grid gap-3 sm:grid-cols-2">
              <input type="hidden" name="userRoleId" value={ur.id} /><input type="hidden" name="userId" value={id} />
              <h2 className="text-sm font-bold text-navy sm:col-span-2">{role.name} assignment</h2>
              <Field label="Role" name="roleKey" defaultValue={ur.roleKey} required options={allRoles.filter((r) => ctx.isMainAdmin || (r.level > ctx.minLevel && r.key !== "main_admin") || r.key === ur.roleKey).map((r) => ({ value: r.key, label: r.name }))} />
              <Field label="Employee ID" name="employeeId" defaultValue={ur.employeeId} />
              <GeoSelect districts={ds} mandals={ms} districtId={ur.districtId ?? ms.find((m) => m.id === ur.mandalId)?.districtId} mandalId={ur.mandalId} required={false} optional />
              <Field label="Reporting officer" name="reportingOfficerId" defaultValue={ur.reportingOfficerId} options={officers.filter((o) => o.id !== id).map((o) => ({ value: o.id, label: o.name }))} />
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="active" defaultChecked={ur.active} /> Assignment active</label>
              <p className="text-xs text-slate-500">Joined {formatDate(ur.joiningDate ?? toDateInput(ur.createdAt))}</p>
              {!self && (
                <div className="flex gap-2 sm:col-span-2"><SubmitButton>Save assignment</SubmitButton><button name="remove" value="1" className="btn btn-outline">Remove role</button></div>
              )}
            </form>
          ))}
          {isAgent && (
            <section className="card grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <h2 className="col-span-full text-sm font-bold text-navy">Agent performance</h2>
              <div><p className="text-xs text-slate-500">Registrations</p><p className="text-xl font-bold">{reg.total}</p></div>
              <div><p className="text-xs text-slate-500">Approved</p><p className="text-xl font-bold text-green-700">{reg.active}</p></div>
              <div><p className="text-xs text-slate-500">Pending</p><p className="text-xl font-bold text-amber-600">{reg.pending}</p></div>
              <div><p className="text-xs text-slate-500">Verified collections</p><p className="text-xl font-bold">{formatINR(col.verified)}</p><p className="text-[11px] text-slate-400">{col.pending} awaiting verification</p></div>
              {s.commissionPerRegistrationPaise > 0 && <p className="col-span-full text-xs text-slate-600">Commission ({formatINR(s.commissionPerRegistrationPaise)} × {reg.active} verified approved registrations) = <b>{formatINR(s.commissionPerRegistrationPaise * reg.active)}</b></p>}
            </section>
          )}
          <section className="card text-xs"><h2 className="mb-1 text-sm font-bold text-navy">Account activity</h2>{activity.length === 0 ? <p className="text-slate-500">No recorded activity.</p> : activity.map((a) => <p key={a.id}>{formatDateTime(a.createdAt)} — {a.action}</p>)}</section>
        </div>
        <div className="space-y-4">
          <section className="card flex items-center gap-3"><Avatar src={u.photoUrl} name={u.fullName} size={56} /><div className="text-sm"><p className="font-bold">{u.fullName}</p><p className="text-xs text-slate-500">Last login: {formatDateTime(u.lastLoginAt)}</p><p className="text-xs text-slate-500">Active sessions: {sess.n}</p></div></section>
          {!self && (
            <section className="card space-y-2">
              <form action={setUserStatusAction}><input type="hidden" name="userId" value={id} />
                {u.status === "suspended" ? <button name="status" value="active" className="btn btn-success btn-sm w-full">Activate account</button> : <SubmitButton className="btn-danger btn-sm w-full" confirm="Suspend this account and revoke all sessions?">Suspend account</SubmitButton>}
                {u.status !== "suspended" && <input type="hidden" name="status" value="suspended" />}
              </form>
              <form action={revokeSessionsAction}><input type="hidden" name="userId" value={id} /><SubmitButton className="btn-outline btn-sm w-full" confirm="Sign this user out everywhere?">Revoke all sessions</SubmitButton></form>
              <form action={resetLinkAction}><input type="hidden" name="userId" value={id} /><input type="hidden" name="module" value="staff" /><input type="hidden" name="back" value={`/admin/staff/${id}`} /><SubmitButton className="btn-outline btn-sm w-full">Generate reset / activation link</SubmitButton></form>
            </section>
          )}
        </div>
      </div>
      <span className="hidden">{String(districts.name)}{String(mandals.name)}</span>
    </>
  );
}
