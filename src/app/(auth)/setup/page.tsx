import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { userRoles } from "@/db/schema";
import { setupAdminAction } from "@/actions/auth.actions";
import { Field } from "@/components/forms/Field";
import { PasswordInput } from "@/components/forms/PasswordInput";
import { SubmitButton } from "@/components/forms/controls";
import { Flash } from "@/components/shared/ui";

export const metadata = { title: "Main Admin Setup" };

export default async function SetupPage({ searchParams }: { searchParams: Promise<{ msg?: string; err?: string }> }) {
  const sp = await searchParams;
  const admins = await db.select({ id: userRoles.id }).from(userRoles).where(eq(userRoles.roleKey, "main_admin")).limit(1);
  if (admins.length) redirect("/login");
  const tokenRequired = Boolean(process.env.ADMIN_SETUP_TOKEN);
  return (
    <>
      <h1 className="text-xl font-bold text-navy">Main Admin setup</h1>
      <p className="mb-4 text-sm text-slate-500">
        One-time procedure. This page disables itself permanently once the Main Admin exists. Public Main Admin registration is not possible.
      </p>
      {!tokenRequired && (
        <p className="mb-3 rounded-lg bg-amber-50 p-2 text-xs text-amber-800">
          Tip: set <code>ADMIN_SETUP_TOKEN</code> in the server environment to require a secret token for this step.
        </p>
      )}
      <Flash sp={sp} />
      <form action={setupAdminAction} className="space-y-3">
        {tokenRequired && <Field label="Setup token" name="setupToken" required type="password" />}
        <Field label="Full name" name="fullName" required />
        <Field label="Email" name="email" type="email" required autoComplete="email" />
        <Field label="Mobile (optional)" name="mobile" />
        <PasswordInput name="password" label="Password (min 10 characters)" autoComplete="new-password" />
        <PasswordInput name="confirm" label="Confirm password" autoComplete="new-password" />
        <SubmitButton className="btn-primary w-full">Create Main Admin</SubmitButton>
      </form>
    </>
  );
}
