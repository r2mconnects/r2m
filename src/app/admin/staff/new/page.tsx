import { asc, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import { roles, userRoles, users } from "@/db/schema";
import { createStaffAction } from "@/actions/staff.actions";
import { Field } from "@/components/forms/Field";
import { GeoSelect, SubmitButton } from "@/components/forms/controls";
import { Flash, PageHeader } from "@/components/shared/ui";
import { requirePermission } from "@/lib/auth/session";
import { getDistricts, getMandals } from "@/lib/data/geo";

export const metadata = { title: "Add staff" };

export default async function NewStaffPage({ searchParams }: { searchParams: Promise<{ msg?: string; err?: string }> }) {
  const sp = await searchParams;
  const ctx = await requirePermission("staff", "create");
  const [allRoles, ds, ms] = await Promise.all([db.select().from(roles).where(ne(roles.key, "member")).orderBy(asc(roles.level)), getDistricts(), getMandals()]);
  const rolesOk = allRoles.filter((r) => ctx.isMainAdmin || (r.level > ctx.minLevel && r.key !== "main_admin"));
  const officers = await db.select({ id: users.id, name: users.fullName, role: userRoles.roleKey }).from(userRoles).innerJoin(users, eq(users.id, userRoles.userId)).where(ne(userRoles.roleKey, "member"));
  const allowedD = ctx.scope.global ? ds : ds.filter((d) => ctx.scope.districtIds.includes(d.id));
  const allowedM = ctx.scope.global ? ms : ms.filter((m) => ctx.scope.districtIds.includes(m.districtId) || ctx.scope.mandalIds.includes(m.id));
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Add Staff / Agent" subtitle="The person receives a secure activation link and sets their own password." crumbs={[{ label: "Staff", href: "/admin/staff" }, { label: "Add" }]} />
      <Flash sp={sp} />
      <form action={createStaffAction} className="card grid gap-3 sm:grid-cols-2">
        <Field label="Full name" name="fullName" required />
        <Field label="Mobile number" name="mobile" type="tel" required hint="If this person is already a member, the role is added to their existing account." />
        <Field label="Email" name="email" type="email" />
        <Field label="Employee ID" name="employeeId" />
        <Field label="Role" name="roleKey" required options={[{ value: "", label: "Select role" }, ...rolesOk.map((r) => ({ value: r.key, label: `${r.name} (${r.scope})` }))]} />
        <Field label="Reporting officer" name="reportingOfficerId" options={officers.map((o) => ({ value: o.id, label: `${o.name} — ${o.role.replace(/_/g, " ")}` }))} />
        <GeoSelect districts={allowedD} mandals={allowedM} required={false} optional />
        <Field label="Joining date" name="joiningDate" type="date" />
        <Field label="Photograph" name="photo" type="file" accept="image/*" />
        <p className="text-xs text-slate-500 sm:col-span-2">District roles need a district; mandal roles need a mandal; agents may be tied to a mandal (otherwise they see only members they register). Permissions come from the role — edit them under Roles & Permissions.</p>
        <div className="sm:col-span-2"><SubmitButton>Create account</SubmitButton></div>
      </form>
    </div>
  );
}
