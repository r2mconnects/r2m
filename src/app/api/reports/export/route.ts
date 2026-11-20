import { NextResponse } from "next/server";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  districts, eventRegistrations, mandals, members, orders, paymentTransactions, userRoles, users, orderItems,
} from "@/db/schema";
import { can, getAuth } from "@/lib/auth/session";
import { memberScope } from "@/lib/scope";
import { audit } from "@/lib/audit";
import { toCsv } from "@/lib/utils";

/** CSV exports. Every export is permission-checked, scoped and audited. */
export async function GET(req: Request) {
  const ctx = await getAuth();
  if (!ctx) return new NextResponse("Unauthorized", { status: 401 });
  const url = new URL(req.url);
  const type = url.searchParams.get("type") ?? "";
  let rows: Array<Record<string, unknown>> = [];

  if (type === "members") {
    if (!can(ctx, "members", "export") && !can(ctx, "reports", "export")) return new NextResponse("Forbidden", { status: 403 });
    const q = url.searchParams.get("q");
    const conds = [memberScope(ctx)];
    if (q) conds.push(or(ilike(members.fullName, `%${q}%`), ilike(members.mobile, `%${q}%`), ilike(members.membershipNo, `%${q}%`)));
    for (const k of ["status", "districtId", "mandalId"] as const) { const v = url.searchParams.get(k); if (v) conds.push(eq(members[k], v)); }
    const r = await db.select({ m: members, d: districts.name, md: mandals.name }).from(members).leftJoin(districts, eq(districts.id, members.districtId)).leftJoin(mandals, eq(mandals.id, members.mandalId)).where(and(...conds)).orderBy(desc(members.createdAt));
    rows = r.map(({ m, d, md }) => ({ membership_no: m.membershipNo, application_ref: m.applicationRef, name: m.fullName, mobile: m.mobile, email: m.email, district: d, mandal: md, workshop: m.workshopName, status: m.status, valid_till: m.validTill, registered: m.createdAt.toISOString() }));
  } else if (type === "payments") {
    if (!can(ctx, "payments", "export")) return new NextResponse("Forbidden", { status: 403 });
    const year = parseInt(url.searchParams.get("year") ?? "", 10) || new Date().getFullYear();
    const r = await db.select({ t: paymentTransactions, who: members.fullName }).from(paymentTransactions).leftJoin(members, eq(members.id, paymentTransactions.memberId)).where(and(eq(paymentTransactions.status, "paid"), sql`extract(year from ${paymentTransactions.paidAt}) = ${year}`));
    rows = r.map(({ t, who }) => ({ receipt: t.receiptNo, date: t.paidAt?.toISOString(), member: who, book: t.kind, method: t.method, amount_inr: t.amountPaise / 100, reference: t.gatewayPaymentId }));
  } else if (type === "orders" || type === "sales") {
    if (!can(ctx, "orders", "export") && !can(ctx, "shop", "export")) return new NextResponse("Forbidden", { status: 403 });
    const r = await db.select().from(orders).orderBy(desc(orders.createdAt));
    rows = r.map((o) => ({ order_no: o.orderNo, date: o.createdAt.toISOString(), customer: o.address.name, mobile: o.address.mobile, total_inr: o.totalPaise / 100, gst_inr: o.gstPaise / 100, payment: o.paymentStatus, status: o.status }));
    void orderItems;
  } else if (type === "attendance") {
    if (!can(ctx, "events", "export")) return new NextResponse("Forbidden", { status: 403 });
    const eventId = url.searchParams.get("eventId") ?? "";
    const r = await db.select({ r: eventRegistrations, m: members }).from(eventRegistrations).innerJoin(members, eq(members.id, eventRegistrations.memberId)).where(eq(eventRegistrations.eventId, eventId));
    rows = r.map(({ r: x, m }) => ({ membership_no: m.membershipNo, name: m.fullName, mobile: m.mobile, attended: x.attended ? "yes" : "no" }));
  } else if (type === "agents") {
    if (!can(ctx, "reports", "export")) return new NextResponse("Forbidden", { status: 403 });
    const r = await db.select({ name: users.fullName, total: sql<number>`count(${members.id})::int`, active: sql<number>`count(*) filter (where ${members.status}='active')::int` }).from(userRoles).innerJoin(users, eq(users.id, userRoles.userId)).leftJoin(members, eq(members.agentId, users.id)).where(eq(userRoles.roleKey, "agent")).groupBy(users.fullName);
    rows = r;
  } else return new NextResponse("Unknown export", { status: 400 });

  await audit(ctx.user.id, "export", "report", type, { rows: rows.length });
  const csv = rows.length ? toCsv(rows) : "no data";
  return new NextResponse(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="r2m-${type}-${new Date().toISOString().slice(0, 10)}.csv"` } });
}
