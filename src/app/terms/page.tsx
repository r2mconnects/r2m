import Link from "next/link";
import { Logo } from "@/components/shared/Logo";
import { getSettings } from "@/lib/settings";

export const metadata = { title: "Terms & Conditions" };

export default async function TermsPage() {
  const s = await getSettings();
  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <Logo />
      <h1 className="h-title mt-6">Terms & Conditions</h1>
      <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">{s.terms}</p>
      <Link href="/login" className="link mt-6 inline-block text-sm">← Back</Link>
    </div>
  );
}
