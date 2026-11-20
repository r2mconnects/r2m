import { createMemberByStaffAction } from "@/actions/membership.actions";
import { Checkbox, Field } from "@/components/forms/Field";
import { GeoSelect, SubmitButton } from "@/components/forms/controls";
import { Flash, PageHeader } from "@/components/shared/ui";
import { requirePermission } from "@/lib/auth/session";
import { getDistricts, getMandals } from "@/lib/data/geo";

export const metadata = { title: "Register member" };

export default async function NewMemberPage({ searchParams }: { searchParams: Promise<{ msg?: string; err?: string }> }) {
  const sp = await searchParams;
  const ctx = await requirePermission("members", "create");
  const [ds, ms] = await Promise.all([getDistricts(), getMandals()]);
  const allowedD = ctx.scope.global ? ds : ds.filter((d) => ctx.scope.districtIds.includes(d.id) || ms.some((m) => m.districtId === d.id && ctx.scope.mandalIds.includes(m.id)));
  const allowedM = ctx.scope.global ? ms : ms.filter((m) => ctx.scope.districtIds.includes(m.districtId) || ctx.scope.mandalIds.includes(m.id));
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Register a Member" subtitle="Registration is recorded against you as the registering agent; another officer must approve it." crumbs={[{ label: "Members", href: "/admin/members" }, { label: "New" }]} />
      <Flash sp={sp} />
      <form action={createMemberByStaffAction} className="card grid gap-3 sm:grid-cols-2">
        <Field label="Full name" name="fullName" required />
        <Field label="Mobile number" name="mobile" type="tel" required />
        <Field label="Email" name="email" type="email" />
        <Field label="Date of birth" name="dob" type="date" />
        <Field label="Garage / workshop name" name="workshopName" required />
        <Field label="Workshop address" name="workshopAddress" />
        <GeoSelect districts={allowedD} mandals={allowedM} />
        <Field label="Village / town" name="village" />
        <Field label="Experience (years)" name="experienceYears" type="number" min={0} />
        <Field label="Specialization" name="specialization" />
        <Field label="Address" name="address" required rows={2} className="sm:col-span-2" />
        <Field label="Emergency contact" name="emergencyName" />
        <Field label="Emergency phone" name="emergencyPhone" />
        <Field label="Nominee" name="nomineeName" />
        <Field label="Nominee relation" name="nomineeRelation" />
        <Field label="Photograph" name="photo" type="file" accept="image/*" required />
        <Field label="ID proof" name="idProof" type="file" accept="image/*,application/pdf" />
        <div className="sm:col-span-2"><Checkbox name="directoryOptIn" label="Member agrees to be listed in the mechanic directory" /></div>
        <div className="sm:col-span-2"><SubmitButton>Create application</SubmitButton></div>
      </form>
    </div>
  );
}
