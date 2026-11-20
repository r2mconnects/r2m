import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { logoutAction } from "@/actions/auth.actions";

export const metadata = { title: "Unauthorized" };

export default function Unauthorized() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <ShieldAlert size={48} className="text-red-600" />
      <h1 className="mt-3 text-xl font-bold text-navy">You don&apos;t have access to this page</h1>
      <p className="mt-1 max-w-sm text-sm text-slate-600">Your role does not include this area. If you believe this is a mistake, contact the association office.</p>
      <div className="mt-4 flex gap-2">
        <Link href="/" className="btn btn-primary">Go to my home</Link>
        <form action={logoutAction}><button className="btn btn-outline">Logout</button></form>
      </div>
    </div>
  );
}
