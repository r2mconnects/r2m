import { saveMandalAction } from "@/actions/settings.actions";
import { SubmitButton } from "@/components/forms/controls";
import { Flash, PageHeader } from "@/components/shared/ui";
import { can, requirePermission } from "@/lib/auth/session";
import { getDistricts, getMandals } from "@/lib/data/geo";

export const metadata = { title: "Mandals" };

export default async function MandalsPage({ searchParams }: { searchParams: Promise<{ districtId?: string; msg?: string; err?: string }> }) {
  const sp = await searchParams;
  const ctx = await requirePermission("geography", "view");
  const [ds, all] = await Promise.all([getDistricts(false), getMandals(false)]);
  const list = sp.districtId ? all.filter((m) => m.districtId === sp.districtId) : all;
  const edit = can(ctx, "geography", "edit");
  return (
    <>
      <PageHeader title="Mandals" crumbs={[{ label: "Districts & Mandals" }, { label: "Mandals" }]} />
      <Flash sp={sp} />
      <form className="mb-3 flex gap-2"><select name="districtId" defaultValue={sp.districtId ?? ""} className="input max-w-56"><option value="">All districts</option>{ds.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select><button className="btn btn-outline btn-sm">Filter</button></form>
      {can(ctx, "geography", "create") && (
        <form action={saveMandalAction} className="card mb-4 flex flex-wrap items-end gap-2">
          <div><label className="label" htmlFor="md">District</label><select id="md" name="districtId" required defaultValue={sp.districtId ?? ""} className="input"><option value="">Select</option>{ds.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
          <div><label className="label" htmlFor="mn">New mandal</label><input id="mn" name="name" required className="input" /></div>
          <SubmitButton>Add mandal</SubmitButton>
        </form>
      )}
      <div className="card divide-y !p-0">
        {list.map((m) => (
          <form key={m.id} action={saveMandalAction} className="flex flex-wrap items-center gap-3 px-3 py-2">
            <input type="hidden" name="id" value={m.id} />
            <select name="districtId" defaultValue={m.districtId} disabled={!edit} className="input max-w-44">{ds.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select>
            <input name="name" defaultValue={m.name} disabled={!edit} className="input max-w-52" aria-label="Mandal name" />
            <label className="flex items-center gap-1 text-sm"><input type="checkbox" name="active" defaultChecked={m.active} disabled={!edit} /> Active</label>
            {edit && <SubmitButton className="btn-outline btn-sm">Save</SubmitButton>}
          </form>
        ))}
      </div>
    </>
  );
}
