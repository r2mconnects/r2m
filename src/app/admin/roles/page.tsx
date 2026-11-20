import { asc } from "drizzle-orm";
import { db } from "@/db";
import { roles } from "@/db/schema";
import { createRoleAction, saveRoleAction } from "@/actions/settings.actions";
import { Field } from "@/components/forms/Field";
import { SubmitButton } from "@/components/forms/controls";
import { Flash, PageHeader } from "@/components/shared/ui";
import { ACTIONS, MODULES } from "@/constants/roles";
import { requirePermission } from "@/lib/auth/session";

export const metadata = { title: "Roles & permissions" };

export default async function RolesPage({ searchParams }: { searchParams: Promise<{ msg?: string; err?: string }> }) {
  const sp = await searchParams;
  await requirePermission("roles", "view");
  const list = await db.select().from(roles).orderBy(asc(roles.level));
  return (
    <>
      <PageHeader title="Roles & Permissions" subtitle="Permission matrix per module and action. Lower level number = higher authority. Scope limits data to area." crumbs={[{ label: "Staff", href: "/admin/staff" }, { label: "Roles" }]} />
      <Flash sp={sp} />
      <form action={createRoleAction} className="card mb-4 grid gap-3 sm:grid-cols-5">
        <Field label="New custom role" name="name" required placeholder="e.g. Training Coordinator" className="sm:col-span-2" />
        <Field label="Scope" name="scope" required options={[{ value: "global", label: "Entire association" }, { value: "district", label: "District" }, { value: "mandal", label: "Mandal" }, { value: "agent", label: "Agent (own members)" }]} />
        <Field label="Level" name="level" type="number" defaultValue={50} />
        <div className="flex items-end"><SubmitButton>Create role</SubmitButton></div>
      </form>
      <div className="space-y-3">
        {list.map((r) => (
          <details key={r.key} className="card">
            <summary className="cursor-pointer text-sm font-bold text-navy">{r.name} <span className="ml-2 text-xs font-normal text-slate-500">scope: {r.scope} • level {r.level}{r.key === "main_admin" ? " • full access (locked)" : ""}</span></summary>
            {r.key === "main_admin" || r.key === "member" ? (
              <p className="mt-2 text-sm text-slate-500">{r.key === "member" ? "Members use the member area; no admin permissions." : "The Main Admin always has every permission."}</p>
            ) : (
              <form action={saveRoleAction} className="mt-3 space-y-3">
                <input type="hidden" name="key" value={r.key} />
                <div className="grid gap-3 sm:grid-cols-3"><Field label="Name" name="name" defaultValue={r.name} /><Field label="Level" name="level" type="number" defaultValue={r.level} /></div>
                <div className="overflow-x-auto">
                  <table className="tbl"><thead><tr><th>Module</th>{ACTIONS.map((a) => <th key={a} className="text-center capitalize">{a}</th>)}</tr></thead>
                    <tbody>{MODULES.map((m) => (
                      <tr key={m.key}><td>{m.label}</td>{ACTIONS.map((a) => <td key={a} className="text-center"><input type="checkbox" name={`p_${m.key}_${a}`} defaultChecked={(r.permissions[m.key] ?? []).includes(a)} aria-label={`${m.label} ${a}`} /></td>)}</tr>
                    ))}</tbody></table>
                </div>
                <p className="text-xs text-slate-500">Recommend (welfare.edit), approve (welfare.approve) and disburse (disbursements.manage) are separate permissions — assign them to different officers.</p>
                <SubmitButton>Save permissions</SubmitButton>
              </form>
            )}
          </details>
        ))}
      </div>
    </>
  );
}
