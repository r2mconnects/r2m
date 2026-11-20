import Link from "next/link";
import { LogOut } from "lucide-react";
import { DRAWER_LINKS } from "@/constants/navigation";
import { Icon } from "@/components/shared/Icon";
import { Avatar, StatusBadge } from "@/components/shared/ui";
import { logoutAction } from "@/actions/auth.actions";
import { requireMember } from "@/lib/auth/session";
import { getLang, t } from "@/lib/i18n";
import { getMemberFull } from "@/lib/data/members";

export const metadata = { title: "Member" };

export default async function MemberHome() {
  const ctx = await requireMember();
  const lang = await getLang();
  const full = await getMemberFull(ctx.member.id);
  const m = ctx.member;
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <section className="card flex items-center gap-4">
        <Avatar src={m.photoUrl} name={m.fullName} size={72} />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-bold text-navy">{m.fullName}</h1>
          <p className="text-xs text-slate-600">{m.membershipNo ?? m.applicationRef} • {m.mobile}</p>
          <p className="text-xs text-slate-600">{m.email ?? "No email"}</p>
          <p className="text-xs text-slate-600">{full?.district ?? "—"} / {full?.mandal ?? "—"} • {m.workshopName ?? "—"}</p>
        </div>
        <StatusBadge status={m.status} />
      </section>
      <div className="flex gap-2">
        <Link href="/member/profile" className="btn btn-primary flex-1">Edit Profile</Link>
        <Link href="/member/settings" className="btn btn-outline flex-1">Change Password</Link>
      </div>
      <section className="card !p-1">
        {DRAWER_LINKS.filter((l) => l.href !== "/member").map((l) => (
          <Link key={l.key} href={l.href} className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm hover:bg-slate-50">
            <Icon name={l.icon} size={18} className="text-royal" />
            <span className="flex-1 font-medium">{t(lang, l.key)}</span>
            <span className="text-slate-400">›</span>
          </Link>
        ))}
        <form action={logoutAction}>
          <button className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-sm font-semibold text-red-600 hover:bg-red-50">
            <LogOut size={18} /> {t(lang, "logout")}
          </button>
        </form>
      </section>
    </div>
  );
}
