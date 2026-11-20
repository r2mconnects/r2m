import { changePasswordAction as changePw, setLanguageAction } from "@/actions/member.actions";
import { PasswordInput } from "@/components/forms/PasswordInput";
import { SubmitButton } from "@/components/forms/controls";
import { Flash, PageHeader } from "@/components/shared/ui";
import { requireUser } from "@/lib/auth/session";
import { getLang } from "@/lib/i18n";

export const metadata = { title: "Settings" };

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ msg?: string; err?: string }> }) {
  const sp = await searchParams;
  await requireUser();
  const lang = await getLang();
  return (
    <div className="mx-auto max-w-xl space-y-4">
      <PageHeader title="Settings" crumbs={[{ label: "Member", href: "/member" }, { label: "Settings" }]} />
      <Flash sp={sp} />
      <form action={setLanguageAction} className="card space-y-2">
        <h2 className="text-sm font-bold text-navy">Language / భాష</h2>
        <input type="hidden" name="back" value="/member/settings" />
        <div className="flex gap-2">
          <button name="lang" value="en" className={`btn flex-1 ${lang === "en" ? "btn-primary" : "btn-outline"}`}>English</button>
          <button name="lang" value="te" className={`btn flex-1 ${lang === "te" ? "btn-primary" : "btn-outline"}`}>తెలుగు</button>
        </div>
      </form>
      <form action={changePw} className="card space-y-3">
        <h2 className="text-sm font-bold text-navy">Change password</h2>
        <PasswordInput name="current" label="Current password" />
        <PasswordInput name="password" label="New password" autoComplete="new-password" />
        <PasswordInput name="confirm" label="Confirm new password" autoComplete="new-password" />
        <SubmitButton>Change password</SubmitButton>
      </form>
    </div>
  );
}
