import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { memberDocuments, members, welfareApplications } from "@/db/schema";
import { can, getAuth } from "@/lib/auth/session";
import { inMemberScope } from "@/lib/scope";
import { MIME_BY_EXT, readUpload } from "@/lib/uploads";

export async function GET(_req: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const isPrivate = name.startsWith("d-");
  if (isPrivate) {
    const ctx = await getAuth();
    if (!ctx) return new NextResponse("Unauthorized", { status: 401 });
    let memberId: string | null = null;
    const [doc] = await db.select().from(memberDocuments).where(eq(memberDocuments.fileName, name));
    if (doc) memberId = doc.memberId;
    else {
      const [w] = await db
        .select({ memberId: welfareApplications.memberId })
        .from(welfareApplications)
        .where(sql`${welfareApplications.documents}::text like ${"%" + name + "%"}`)
        .limit(1);
      memberId = w?.memberId ?? null;
    }
    if (!memberId) return new NextResponse("Not found", { status: 404 });
    const [m] = await db.select().from(members).where(eq(members.id, memberId));
    const owner = ctx.member?.id === memberId;
    const staff = m && (can(ctx, "members", "view") || can(ctx, "welfare", "view")) && inMemberScope(ctx, m);
    if (!owner && !staff) return new NextResponse("Forbidden", { status: 403 });
  }
  const buf = await readUpload(name);
  if (!buf) return new NextResponse("Not found", { status: 404 });
  const ext = name.split(".").pop() ?? "";
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": MIME_BY_EXT[ext] ?? "application/octet-stream",
      "Cache-Control": isPrivate ? "private, no-store" : "public, max-age=86400",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
