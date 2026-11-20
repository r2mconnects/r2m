import Link from "next/link";
import { forgotPasswordAction } from "@/actions/auth.actions";
import { Field } from "@/components/forms/Field";
import { SubmitButton } from "@/components/forms/controls";
import { Flash } from "@/components/shared/ui";

export const metadata = { title: "Forgot password" };

export default async function ForgotPage({ searchParams }: { searchParams: Promise<{ msg?: string; err?: string }> }) {
  const sp = await searchParams;
  return (
    <>
      <h1 className="text-xl font-bold text-navy">Forgot password</h1>
      <p className="mb-4 text-sm text-slate-500">Enter your registered mobile number or email.</p>
      <Flash sp={sp} />
      <form action={forgotPasswordAction} className="space-y-3">
        <Field label="Mobile number or email" name="identifier" required />
        <SubmitButton className="btn-primary w-full">Request reset link</SubmitButton>
      </form>
      <p className="mt-4 text-center text-sm">
        <Link href="/login" className="link">Back to login</Link>
      </p>
    </>
  );
}
