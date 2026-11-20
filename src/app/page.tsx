import { redirect } from "next/navigation";
import { getAuth, homeFor } from "@/lib/auth/session";

export default async function Index() {
  const ctx = await getAuth();
  redirect(ctx ? homeFor(ctx) : "/login");
}
