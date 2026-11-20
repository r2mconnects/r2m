import Link from "next/link";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "@/db";
import { passwordResets } from "@/db/schema";
import { resetPasswordAction } from "@/actions/auth.actions";
import { PasswordInput } from "@/components/forms/PasswordInput";
import { SubmitButton } from "@/components/forms/controls";
import { Flash } from "@/components/shared/ui";
import { sha256 } from "@/lib/utils";

export const metadata = { title: "Set password" };

export default async function ResetPage({ searchParams }: { searchParams: Promise<{ token?: string; msg?: string; err?: string }> }) {
  const sp = await searchParams;
  const token = sp.token ?? "";
  const [r] = token
    ? await db
        .select()
        .from(passwordResets)
        .where(and(eq(passwordResets.tokenHash, sha256(token)), isNull(passwordResets.usedAt), gt(passwordResets.expiresAt, new Date())))
    : [];
  if (!r)
    return (
      <>
        <h1 className="text-xl font-bold text-navy">Link not valid</h1>
        <p className="mt-2 text-sm text-slate-600">This link is invalid, already used, or expired. Please ask the association office for a new link.</p>
        <Link href="/login" className="link mt-4 inline-block text-sm">Back to login</Link>
      </>
    );
  const activation = r.purpose === "activation";
  return (
    <>
      <h1 className="text-xl font-bold text-navy">{activation ? "Activate your account" : "Reset password"}</h1>
      <p className="mb-4 text-sm text-slate-500">Choose a strong password with letters and numbers.</p>
      <Flash sp={sp} />
      <form action={resetPasswordAction} className="space-y-3">
        <input type="hidden" name="token" value={token} />
        <PasswordInput name="password" label="New password" autoComplete="new-password" />
        <PasswordInput name="confirm" label="Confirm password" autoComplete="new-password" />
        <SubmitButton className="btn-primary w-full">{activation ? "Activate account" : "Save password"}</SubmitButton>
      </form>
    </>
  );
}
