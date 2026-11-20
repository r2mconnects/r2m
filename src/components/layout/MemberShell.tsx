"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Bell, ChevronDown, LogOut, Menu, ShoppingCart, ShieldCheck, X } from "lucide-react";
import { BOTTOM_NAV, DRAWER_LINKS } from "@/constants/navigation";
import { Icon } from "@/components/shared/Icon";
import { Logo, LogoMark } from "@/components/shared/Logo";
import { Avatar } from "@/components/shared/ui";
import { logoutAction } from "@/actions/auth.actions";
import { cn } from "@/lib/cn";

type Props = {
  children: ReactNode;
  labels: Record<string, string>;
  user: { name: string; photoUrl: string | null; memberNo: string | null };
  unread: number;
  cartCount: number;
  canAdmin: boolean;
  assoc: string;
};

const ACTIVE_GROUPS: Record<string, string[]> = {
  home: ["/home"],
  news: ["/news"],
  events: ["/events"],
  shop: ["/shop"],
  member: ["/member", "/welfare", "/emergency", "/blood-donors", "/mechanics", "/notifications"],
};

export function MemberShell({ children, labels, user, unread, cartCount, canAdmin, assoc }: Props) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const isActive = (key: string) => (ACTIVE_GROUPS[key] ?? []).some((p) => path === p || path.startsWith(p + "/"));
  const desktopNav = [
    ...BOTTOM_NAV,
    { key: "welfare", href: "/welfare", icon: "HeartHandshake" },
    { key: "payments", href: "/member/payments", icon: "Receipt" },
  ];

  return (
    <div className="min-h-screen bg-page">
      {/* Header (mobile + desktop) */}
      <header className="no-print sticky top-0 z-30 bg-navy text-white shadow">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-2 px-3 md:px-6">
          <button className="rounded-lg p-2 hover:bg-white/10 md:hidden" onClick={() => setOpen(true)} aria-label="Open menu">
            <Menu size={22} />
          </button>
          <Link href="/home" className="flex items-center gap-2">
            <span className="hidden rounded-lg bg-white px-2 py-1 md:block"><Logo small size={30} /></span>
            <span className="md:hidden"><span className="inline-flex items-center gap-2"><span className="rounded-full bg-white p-0.5"><LogoMark size={28} /></span><span className="leading-tight"><span className="block text-sm font-extrabold">R<span className="text-accent">2</span>M CONNECT</span><span className="block max-w-[150px] truncate text-[9px] text-blue-100">{assoc}</span></span></span></span>
          </Link>
          <nav className="ml-4 hidden items-center gap-1 md:flex" aria-label="Primary">
            {desktopNav.map((n) => (
              <Link
                key={n.key}
                href={n.href}
                className={cn(
                  "rounded-lg px-3 py-2 text-sm font-semibold",
                  (n.key === "payments" ? path.startsWith("/member/payments") : isActive(n.key)) ? "bg-white/15 text-white" : "text-blue-100 hover:bg-white/10",
                )}
              >
                {labels[n.key === "member" ? "member" : n.key]}
              </Link>
            ))}
            {canAdmin && (
              <Link href="/admin/dashboard" className="rounded-lg px-3 py-2 text-sm font-semibold text-accent hover:bg-white/10">
                {labels.adminPanel}
              </Link>
            )}
            <details className="group relative">
              <summary className="flex cursor-pointer list-none items-center gap-1 rounded-lg px-3 py-2 text-sm font-semibold text-blue-100 hover:bg-white/10">
                {labels.more} <ChevronDown size={14} />
              </summary>
              <div className="absolute left-0 top-full mt-1 grid w-64 gap-0.5 rounded-xl bg-white p-2 text-ink shadow-xl ring-1 ring-slate-200">
                {DRAWER_LINKS.map((l) => (
                  <Link key={l.key} href={l.href} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-slate-100">
                    <Icon name={l.icon} size={16} className="text-royal" /> {labels[l.key]}
                  </Link>
                ))}
              </div>
            </details>
          </nav>
          <div className="ml-auto flex items-center gap-1">
            <Link href="/shop/cart" className="relative rounded-lg p-2 hover:bg-white/10" aria-label="Cart">
              <ShoppingCart size={20} />
              {cartCount > 0 && <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-navy-dark">{cartCount}</span>}
            </Link>
            <Link href="/notifications" className="relative rounded-lg p-2 hover:bg-white/10" aria-label={labels.notifications}>
              <Bell size={20} />
              {unread > 0 && <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold">{unread > 99 ? "99+" : unread}</span>}
            </Link>
            <details className="relative">
              <summary className="flex cursor-pointer list-none items-center gap-2 rounded-lg p-1 hover:bg-white/10">
                <Avatar src={user.photoUrl} name={user.name} size={32} />
                <span className="hidden text-left text-xs leading-tight lg:block">
                  <span className="block font-semibold">{user.name}</span>
                  <span className="block text-blue-200">{user.memberNo ?? "Applicant"}</span>
                </span>
              </summary>
              <div className="absolute right-0 top-full mt-1 w-52 rounded-xl bg-white p-2 text-ink shadow-xl ring-1 ring-slate-200">
                <p className="truncate px-2 pb-1 text-sm font-semibold">{user.name}</p>
                <Link href="/member/profile" className="block rounded-lg px-2 py-1.5 text-sm hover:bg-slate-100">{labels.profile}</Link>
                <Link href="/member/membership/card" className="block rounded-lg px-2 py-1.5 text-sm hover:bg-slate-100">{labels.card}</Link>
                <Link href="/member/settings" className="block rounded-lg px-2 py-1.5 text-sm hover:bg-slate-100">{labels.settings}</Link>
                <form action={logoutAction}>
                  <button className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-red-600 hover:bg-red-50">
                    <LogOut size={15} /> {labels.logout}
                  </button>
                </form>
              </div>
            </details>
          </div>
        </div>
      </header>

      {/* Drawer */}
      {open && (
        <div className="no-print fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true">
          <button className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} aria-label="Close menu" />
          <aside className="absolute inset-y-0 left-0 flex w-72 max-w-[85%] flex-col bg-white shadow-xl">
            <div className="flex items-center justify-between bg-navy p-3 text-white">
              <div className="flex items-center gap-2">
                <Avatar src={user.photoUrl} name={user.name} size={40} />
                <div className="leading-tight">
                  <p className="text-sm font-semibold">{user.name}</p>
                  <p className="text-xs text-blue-200">{user.memberNo ?? "Applicant"}</p>
                </div>
              </div>
              <button onClick={() => setOpen(false)} aria-label="Close" className="rounded-lg p-2 hover:bg-white/10"><X size={20} /></button>
            </div>
            <nav className="flex-1 overflow-y-auto p-2">
              {canAdmin && (
                <Link href="/admin/dashboard" onClick={() => setOpen(false)} className="mb-1 flex items-center gap-3 rounded-lg bg-amber-50 px-3 py-2.5 text-sm font-semibold text-navy">
                  <ShieldCheck size={18} className="text-accent" /> {labels.adminPanel}
                </Link>
              )}
              {DRAWER_LINKS.map((l) => (
                <Link
                  key={l.key}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className={cn("flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm", path === l.href ? "bg-blue-50 font-semibold text-navy" : "text-slate-700 hover:bg-slate-100")}
                >
                  <Icon name={l.icon} size={18} className="text-royal" /> {labels[l.key]}
                </Link>
              ))}
            </nav>
            <form action={logoutAction} className="border-t p-2">
              <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50">
                <LogOut size={18} /> {labels.logout}
              </button>
            </form>
          </aside>
        </div>
      )}

      <main className="mx-auto max-w-7xl px-3 pb-nav pt-4 md:px-6 md:pb-10">{children}</main>

      {/* Bottom navigation (mobile only) */}
      <nav className="no-print safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white shadow-[0_-2px_8px_rgba(0,0,0,0.06)] md:hidden" aria-label="Bottom navigation">
        <ul className="mx-auto grid max-w-lg grid-cols-5">
          {BOTTOM_NAV.map((n) => {
            const active = isActive(n.key);
            return (
              <li key={n.key}>
                <Link href={n.href} aria-current={active ? "page" : undefined} className={cn("flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold", active ? "text-navy" : "text-slate-500")}>
                  <span className={cn("rounded-full px-4 py-0.5", active && "bg-blue-100")}><Icon name={n.icon} size={21} /></span>
                  {labels[n.key]}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
