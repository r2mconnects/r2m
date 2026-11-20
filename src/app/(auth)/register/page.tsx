import Link from "next/link";
import { registerAction } from "@/actions/auth.actions";
import { Checkbox, Field } from "@/components/forms/Field";
import { PasswordInput } from "@/components/forms/PasswordInput";
import { GeoSelect, SubmitButton } from "@/components/forms/controls";
import { Flash } from "@/components/shared/ui";
import { getDistricts, getMandals } from "@/lib/data/geo";
import { getPlan } from "@/lib/membership/membership";
import { getSettings } from "@/lib/settings";
import { formatINR } from "@/lib/utils";

export const metadata = { title: "Member registration" };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ msg?: string; err?: string }> }) {
  const sp = await searchParams;
  const [districts, mandals, plan, s] = await Promise.all([getDistricts(), getMandals(), getPlan(), getSettings()]);
  const fee = plan ? plan.applicationFeePaise + plan.joiningFeePaise : 0;
  return (
    <>
      <h1 className="text-xl font-bold text-navy">Member registration</h1>
      <p className="mb-3 text-sm text-slate-500">Apply for association membership. Your application is reviewed by the association before activation.</p>
      <Flash sp={sp} />
      <form action={registerAction} className="space-y-3">
        <h2 className="text-sm font-bold text-navy">Personal details</h2>
        <Field label="Full name" name="fullName" required autoComplete="name" />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Mobile number" name="mobile" required type="tel" placeholder="10 digits" autoComplete="tel" />
          <Field label="Date of birth" name="dob" type="date" />
        </div>
        <Field label="Email (optional)" name="email" type="email" autoComplete="email" />
        <PasswordInput name="password" label="Create password" autoComplete="new-password" />
        <PasswordInput name="confirm" label="Confirm password" autoComplete="new-password" />

        <h2 className="pt-2 text-sm font-bold text-navy">Workshop details</h2>
        <Field label="Garage / workshop name" name="workshopName" required />
        <Field label="Workshop address" name="workshopAddress" />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Experience (years)" name="experienceYears" type="number" min={0} />
          <Field label="Specialization" name="specialization" placeholder="e.g. Engine, Electrical" />
        </div>

        <h2 className="pt-2 text-sm font-bold text-navy">Location</h2>
        <div className="grid grid-cols-2 gap-3">
          <GeoSelect districts={districts} mandals={mandals} />
        </div>
        <Field label="Village / town" name="village" />
        <Field label="Residential address" name="address" required rows={2} />

        <h2 className="pt-2 text-sm font-bold text-navy">Emergency contact & nominee</h2>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Emergency contact name" name="emergencyName" />
          <Field label="Emergency phone" name="emergencyPhone" type="tel" />
          <Field label="Nominee name" name="nomineeName" />
          <Field label="Nominee relation" name="nomineeRelation" />
        </div>

        <h2 className="pt-2 text-sm font-bold text-navy">Photograph & documents</h2>
        <Field label="Passport-size photograph" name="photo" type="file" accept="image/jpeg,image/png,image/webp" required hint="JPG/PNG/WebP up to 5 MB. Used on your membership card." />
        <Field label="ID proof (Aadhaar / Voter ID)" name="idProof" type="file" accept="image/*,application/pdf" hint="Stored privately. Visible only to authorized staff." />

        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">
          <p className="font-semibold text-navy">Membership fee: {fee > 0 ? formatINR(fee) : "To be announced by the association"}</p>
          <p className="text-xs text-slate-600">
            {s.paymentPolicy === "before_approval"
              ? "The fee is paid online or to your agent after you submit, and is required before activation."
              : "You pay the fee after your application receives preliminary approval. Nothing is charged now."}
          </p>
        </div>
        <Checkbox
          name="directoryOptIn"
          label="List my workshop in the Find a Mechanic directory (optional; phone shown only if verified)"
        />
        <Checkbox name="consent" label={<>I agree to the <Link href="/terms" className="link" target="_blank">Terms</Link> and <Link href="/privacy" className="link" target="_blank">Privacy Policy</Link>.</>} />
        <p className="text-[11px] text-slate-500">Mobile OTP verification activates automatically once an SMS provider is configured; until then, your application is verified by association staff.</p>
        <SubmitButton className="btn-primary w-full" pending="Submitting…">Submit application</SubmitButton>
      </form>
      <p className="mt-4 text-center text-sm">
        Already registered? <Link href="/login" className="link">Login</Link>
      </p>
    </>
  );
}
