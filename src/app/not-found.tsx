import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <p className="text-5xl font-extrabold text-navy">404</p>
      <p className="mt-2 text-sm text-slate-600">We couldn&apos;t find that page.</p>
      <Link href="/" className="btn btn-primary mt-4">Back to home</Link>
    </div>
  );
}
