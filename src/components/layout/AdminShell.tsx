"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Bell, ChevronLeft, ChevronRight, LogOut, Menu, Search, UserRound, X } from "lucide-react";
import { Icon } from "@/components/shared/Icon";
import { Logo } from "@/components/shared/Logo";
import { Avatar } from "@/components/shared/ui";
import { logoutAction } from "@/actions/auth.actions";
import { cn } from "@/lib/cn";

type NavItem = { label: string; href: string; icon: string; badge?: number };

export function AdminShell({
  children, nav, user, roleLabel, unread, assoc, hasMemberArea, canSearch,
}: {
  children: ReactNode; nav: NavItem[]; user: { name: string; photoUrl: string | null }; roleLabel: string; unread: number; assoc: string; hasMemberArea: boolean; canSearch: boolean;
}) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const active = (href: string) => {
    const base = href.split("?")[0];
    if (href.includes("?")) return false;
    return path === base || (base !== "/admin/dashboard" && path.startsWith(base + "/"));
  };

  const Side = ({ mobile }: { mobile?: boolean }) => (
    <aside className={cn("flex h-full flex-col bg-navy text-white", mobile ? "w-72" : collapsed ? "w-16" : "w-64")}>
      <div className="flex h-14 items-center justify-between px-3">
        {!collapsed || mobile ? <span className="rounded-lg bg-white px-2 py-1"><Logo small size={28} /></span> : <span />}
        {mobile ? (
          <button onClick={() => setOpen(false)} aria-label="Close menu"><X size={20} /></button>
        ) : (
          <button onClick={() => setCollapsed((c) => !c)} className="rounded p-1 hover:bg-white/10" aria-label="Toggle sidebar">{collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}</button>
        )}
      </div>
      {(!collapsed || mobile) && (
        <div className="mx-3 mb-2 flex items-center gap-2 rounded-lg bg-white/10 p-2">
          <Avatar src={user.photoUrl} name={user.name} size={34} />
          <div className="min-w-0 leading-tight"><p className="truncate text-sm font-semibold">{user.name}</p><p className="truncate text-[11px] text-blue-200">{roleLabel}</p></div>
        </div>
      )}
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 pb-3" aria-label="Admin">
        {nav.map((n) => (
          <Link
            key={n.href + n.label}
            href={n.href}
            title={n.label}
            onClick={() => setOpen(false)}
            className={cn("flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium", active(n.href) ? "bg-royal text-white" : "text-blue-100 hover:bg-white/10")}
          >
            <Icon name={n.icon} size={18} />
            {(!collapsed || mobile) && <span className="flex-1">{n.label}</span>}
            {(!collapsed || mobile) && n.badge ? <span className="rounded-full bg-red-500 px-1.5 text-[11px] font-bold">{n.badge}</span> : null}
          </Link>
        ))}
      </nav>
    </aside>
  );

  return (
    <div className="flex min-h-screen bg-page">
      <div className="no-print sticky top-0 hidden h-screen lg:block"><Side /></div>
      {open && (
        <div className="no-print fixed inset-0 z-50 lg:hidden">
          <button className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} aria-label="Close menu" />
          <div className="absolute inset-y-0 left-0"><Side mobile /></div>
        </div>
      )}
      <div className="min-w-0 flex-1">
        <header className="no-print sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-white px-3 shadow-sm md:px-6">
          <button className="rounded-lg p-2 hover:bg-slate-100 lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu"><Menu size={22} /></button>
          <p className="hidden text-sm font-semibold text-navy xl:block">{assoc}</p>
          {canSearch && (
            <form action="/admin/members" className="relative ml-auto max-w-md flex-1">
              <Search size={16} className="absolute left-3 top-3 text-slate-400" />
              <input name="q" placeholder="Search members, mobile, ID…" className="input pl-9" aria-label="Search members" />
            </form>
          )}
          <div className={cn("flex items-center gap-1", !canSearch && "ml-auto")}>
            <Link href="/admin/notifications" className="relative rounded-lg p-2 hover:bg-slate-100" aria-label="Notifications">
              <Bell size={20} />
              {unread > 0 && <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">{unread}</span>}
            </Link>
            <details className="relative">
              <summary className="flex cursor-pointer list-none items-center gap-2 rounded-lg p-1 hover:bg-slate-100"><Avatar src={user.photoUrl} name={user.name} size={32} /></summary>
              <div className="absolute right-0 top-full mt-1 w-52 rounded-xl bg-white p-2 shadow-xl ring-1 ring-slate-200">
                <p className="truncate px-2 text-sm font-semibold">{user.name}</p>
                <p className="truncate px-2 pb-1 text-xs text-slate-500">{roleLabel}</p>
                {hasMemberArea && <Link href="/home" className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-slate-100"><UserRound size={15} /> Member area</Link>}
                <Link href="/admin/account" className="block rounded-lg px-2 py-1.5 text-sm hover:bg-slate-100">My account</Link>
                <form action={logoutAction}><button className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-red-600 hover:bg-red-50"><LogOut size={15} /> Logout</button></form>
              </div>
            </details>
          </div>
        </header>
        <main className="mx-auto max-w-[1400px] p-3 md:p-6">{children}</main>
      </div>
    </div>
  );
}
