import type { ReactNode } from "react";
import Link from "next/link";
import { Logo } from "@/components/shared/Logo";
import { getSettings } from "@/lib/settings";

export default async function AuthLayout({ children }: { children: ReactNode }) {
  const s = await getSettings();
  return (
    <div className="flex min-h-screen flex-col items-center bg-gradient-to-b from-navy to-navy-dark px-4 py-8">
      <div className="mb-5 rounded-xl bg-white px-4 py-3 shadow">
        <Logo />
      </div>
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl sm:p-7">{children}</div>
      <p className="mt-4 text-center text-xs text-blue-100">{s.tagline}</p>
      <p className="mt-1 text-center text-[11px] text-blue-200">
        <Link href="/terms" className="underline">Terms</Link> · <Link href="/privacy" className="underline">Privacy</Link>
      </p>
    </div>
  );
}
