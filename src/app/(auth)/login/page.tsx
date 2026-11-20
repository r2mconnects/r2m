import Link from "next/link";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { userRoles } from "@/db/schema";
import { loginAction } from "@/actions/auth.actions";
import { getAuth, homeFor } from "@/lib/auth/session";
import { Field, Checkbox } from "@/components/forms/Field";
import { PasswordInput } from "@/components/forms/PasswordInput";
import { SubmitButton } from "@/components/forms/controls";
import { Flash } from "@/components/shared/ui";

export const metadata = { title: "Login" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ msg?: string; err?: string }> }) {
  const sp = await searchParams;
  const ctx = await getAuth();
  if (ctx) redirect(homeFor(ctx));
  const admins = await db.select({ id: userRoles.id }).from(userRoles).where(eq(userRoles.roleKey, "main_admin")).limit(1);
  return (
    <>
      <h1 className="text-xl font-bold text-navy">Login</h1>
      <p className="mb-4 text-sm text-slate-500">Members, staff and administrators sign in here.</p>
      <Flash sp={sp} />
      <form action={loginAction} className="space-y-3">
        <Field label="Mobile number or email" name="identifier" required autoComplete="username" placeholder="9876543210 or name@email.com" />
        <PasswordInput />
        <div className="flex items-center justify-between">
          <Checkbox label="Remember me" name="remember" />
          <Link href="/forgot-password" className="link text-sm">Forgot password?</Link>
        </div>
        <SubmitButton className="btn-primary w-full" pending="Signing in…">Login</SubmitButton>
      </form>
      <p className="mt-5 text-center text-sm text-slate-600">
        New mechanic?{" "}
        <Link href="/register" className="link">Register for membership</Link>
      </p>
      {admins.length === 0 && (
        <p className="mt-3 rounded-lg bg-amber-50 p-2 text-center text-xs text-amber-800">
          First-time setup pending. <Link href="/setup" className="link">Create the Main Admin account</Link>
        </p>
      )}
    </>
  );
}
