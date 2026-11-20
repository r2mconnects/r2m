import Link from "next/link";
import { count, eq } from "drizzle-orm";
import { db } from "@/db";
import { districts, mandals, members } from "@/db/schema";
import { saveDistrictAction } from "@/actions/settings.actions";
import { SubmitButton } from "@/components/forms/controls";
import { Flash, PageHeader } from "@/components/shared/ui";
import { can, requirePermission } from "@/lib/auth/session";
import { getDistricts } from "@/lib/data/geo";

export const metadata = { title: "Districts" };

export default async function DistrictsPage({ searchParams }: { searchParams: Promise<{ msg?: string; err?: string }> }) {
  const sp = await searchParams;
  const ctx = await requirePermission("geography", "view");
  const ds = await getDistricts(false);
  const mc = await db.select({ id: mandals.districtId, n: count() }).from(mandals).groupBy(mandals.districtId);
  const memc = await db.select({ id: members.districtId, n: count() }).from(members).groupBy(members.districtId);
  const edit = can(ctx, "geography", "edit");
  return (
    <>
      <PageHeader title="Districts" crumbs={[{ label: "Districts & Mandals" }, { label: "Districts" }]} actions={<Link href="/admin/mandals" className="btn btn-outline btn-sm">Manage mandals</Link>} />
      <Flash sp={sp} />
      {can(ctx, "geography", "create") && (
        <form action={saveDistrictAction} className="card mb-4 flex flex-wrap items-end gap-2"><div><label className="label" htmlFor="nd">New district</label><input id="nd" name="name" className="input" required /></div><SubmitButton>Add district</SubmitButton></form>
      )}
      <div className="card overflow-x-auto !p-0">
        <table className="tbl"><thead><tr><th>District</th><th>Mandals</th><th>Members</th><th>Active</th>{edit && <th></th>}</tr></thead>
          <tbody>{ds.map((d) => (
            <tr key={d.id}>
              <td colSpan={edit ? 5 : 4} className="!p-0">
                <form action={saveDistrictAction} className="flex flex-wrap items-center gap-3 px-3 py-2">
                  <input type="hidden" name="id" value={d.id} />
                  {edit ? <input name="name" defaultValue={d.name} className="input max-w-52" aria-label="District name" /> : <span className="w-52 font-semibold">{d.name}</span>}
                  <span className="w-20 text-sm">{mc.find((x) => x.id === d.id)?.n ?? 0} mandals</span>
                  <span className="w-24 text-sm">{memc.find((x) => x.id === d.id)?.n ?? 0} members</span>
                  <label className="flex items-center gap-1 text-sm"><input type="checkbox" name="active" defaultChecked={d.active} disabled={!edit} /> Active</label>
                  {edit && <SubmitButton className="btn-outline btn-sm">Save</SubmitButton>}
                </form>
              </td>
            </tr>
          ))}</tbody></table>
      </div>
      <span className="hidden">{String(eq)}</span>
    </>
  );
}
