import { updateProfileAction, requestChangeAction } from "@/actions/member.actions";
import { Checkbox, Field } from "@/components/forms/Field";
import { SubmitButton } from "@/components/forms/controls";
import { Avatar, Flash, PageHeader } from "@/components/shared/ui";
import { requireMember } from "@/lib/auth/session";
import { getMemberFull } from "@/lib/data/members";
import { toDateInput } from "@/lib/utils";

export const metadata = { title: "My Profile" };

export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ msg?: string; err?: string }> }) {
  const sp = await searchParams;
  const ctx = await requireMember();
  const m = ctx.member;
  const full = await getMemberFull(m.id);
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="My Profile" crumbs={[{ label: "Member", href: "/member" }, { label: "Profile" }]} />
      <Flash sp={sp} />
      <section className="card mb-4 grid gap-2 text-sm sm:grid-cols-2">
        <div className="flex items-center gap-3 sm:col-span-2"><Avatar src={m.photoUrl} name={m.fullName} size={56} /><div><p className="font-bold text-navy">{m.fullName}</p><p className="text-xs text-slate-500">{m.membershipNo ?? m.applicationRef}</p></div></div>
        <p><b>Mobile:</b> {m.mobile}</p>
        <p><b>District:</b> {full?.district ?? "—"}</p>
        <p><b>Mandal:</b> {full?.mandal ?? "—"}</p>
        <p className="text-xs text-slate-500 sm:col-span-2">Name, mobile number and location are verified details. Use “Request a change” below.</p>
      </section>
      <form action={updateProfileAction} className="card grid gap-3 sm:grid-cols-2">
        <Field label="Email" name="email" type="email" defaultValue={m.email} />
        <Field label="Date of birth" name="dob" type="date" defaultValue={toDateInput(m.dob)} />
        <Field label="Village / town" name="village" defaultValue={m.village} />
        <Field label="Address" name="address" defaultValue={m.address} />
        <Field label="Workshop name" name="workshopName" defaultValue={m.workshopName} />
        <Field label="Workshop address" name="workshopAddress" defaultValue={m.workshopAddress} />
        <Field label="Experience (years)" name="experienceYears" type="number" min={0} defaultValue={m.experienceYears} />
        <Field label="Specialization" name="specialization" defaultValue={m.specialization} />
        <Field label="Services offered (directory)" name="services" defaultValue={m.services} />
        <Field label="Working hours (directory)" name="workingHours" defaultValue={m.workingHours} />
        <Field label="Emergency contact name" name="emergencyName" defaultValue={m.emergencyName} />
        <Field label="Emergency contact phone" name="emergencyPhone" defaultValue={m.emergencyPhone} />
        <Field label="Nominee name" name="nomineeName" defaultValue={m.nomineeName} />
        <Field label="Nominee relation" name="nomineeRelation" defaultValue={m.nomineeRelation} />
        <Field label="Replace photograph" name="photo" type="file" accept="image/jpeg,image/png,image/webp" className="sm:col-span-2" />
        <div className="sm:col-span-2"><Checkbox name="directoryOptIn" defaultChecked={m.directoryOptIn} label="List my workshop in Find a Mechanic (shown publicly only after admin verification)" /></div>
        <div className="sm:col-span-2"><SubmitButton>Save changes</SubmitButton></div>
      </form>
      <form action={requestChangeAction} className="card mt-4 space-y-2">
        <h2 className="text-sm font-bold text-navy">Request a change to name, mobile or location</h2>
        <Field label="What should be changed?" name="detail" rows={2} required />
        <SubmitButton className="btn-outline">Send request</SubmitButton>
      </form>
    </div>
  );
}
