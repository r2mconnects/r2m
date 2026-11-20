import { changePasswordAction } from "@/actions/member.actions";
import { PasswordInput } from "@/components/forms/PasswordInput";
import { SubmitButton } from "@/components/forms/controls";
import { Avatar, Flash, PageHeader } from "@/components/shared/ui";
import { requireStaff } from "@/lib/auth/session";

export const metadata = { title: "My account" };

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ msg?: string; err?: string }> }) {
  const sp = await searchParams;
  const ctx = await requireStaff();
  return (
    <div className="mx-auto max-w-xl space-y-4">
      <PageHeader title="My Account" crumbs={[{ label: "Account" }]} />
      <Flash sp={sp} />
      <section className="card flex items-center gap-3"><Avatar src={ctx.user.photoUrl} name={ctx.user.fullName} size={56} /><div className="text-sm"><p className="font-bold">{ctx.user.fullName}</p><p className="text-slate-500">{ctx.roles.map((r) => r.roleName).join(", ")}</p><p className="text-slate-500">{ctx.user.mobile} {ctx.user.email}</p></div></section>
      <form action={changePasswordAction} className="card space-y-3"><h2 className="text-sm font-bold text-navy">Change password</h2>
        <PasswordInput name="current" label="Current password" /><PasswordInput name="password" label="New password" autoComplete="new-password" /><PasswordInput name="confirm" label="Confirm new password" autoComplete="new-password" />
        <SubmitButton>Change password</SubmitButton></form>
    </div>
  );
}
