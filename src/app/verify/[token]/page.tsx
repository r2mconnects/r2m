import { eq } from "drizzle-orm";
import { ShieldCheck, ShieldX } from "lucide-react";
import { db } from "@/db";
import { districts, mandals, members, membershipCards } from "@/db/schema";
import { Logo } from "@/components/shared/Logo";
import { getSettings } from "@/lib/settings";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Verify membership" };

export default async function VerifyPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const s = await getSettings();
  const [row] = await db
    .select({ m: members, card: membershipCards, district: districts.name, mandal: mandals.name })
    .from(membershipCards)
    .innerJoin(members, eq(members.id, membershipCards.memberId))
    .leftJoin(districts, eq(districts.id, members.districtId))
    .leftJoin(mandals, eq(mandals.id, members.mandalId))
    .where(eq(membershipCards.token, token));

  const today = new Date().toISOString().slice(0, 10);
  let status = "invalid";
  if (row) {
    status = row.card.status !== "active" ? row.card.status : row.m.status === "active" && row.m.validTill && row.m.validTill < today ? "expired" : row.m.status;
  }
  const ok = status === "active";
  return (
    <div className="flex min-h-screen flex-col items-center bg-page px-4 py-8">
      <div className="mb-4 rounded-xl bg-white px-4 py-3 shadow"><Logo /></div>
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-lg">
        {!row ? (
          <>
            <ShieldX className="mx-auto text-red-600" size={48} />
            <h1 className="mt-2 text-xl font-bold text-red-700">Invalid card</h1>
            <p className="mt-1 text-sm text-slate-600">This QR code does not match any R2M CONNECT membership.</p>
          </>
        ) : (
          <>
            {ok ? <ShieldCheck className="mx-auto text-green-600" size={48} /> : <ShieldX className="mx-auto text-red-600" size={48} />}
            <h1 className={`mt-2 text-xl font-bold ${ok ? "text-green-700" : "text-red-700"}`}>
              {ok ? "Active Member" : status.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase())}
            </h1>
            <p className="text-xs text-slate-500">{s.associationName}</p>
            {row.m.photoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={row.m.photoUrl} alt={row.m.fullName} className="mx-auto mt-4 h-28 w-24 rounded-lg border object-cover" />
            )}
            <p className="mt-3 text-lg font-bold text-navy">{row.m.fullName}</p>
            <dl className="mt-2 space-y-1 text-sm">
              <div><dt className="inline font-semibold">Membership ID: </dt><dd className="inline">{row.m.membershipNo}</dd></div>
              <div><dt className="inline font-semibold">District / Mandal: </dt><dd className="inline">{row.district} / {row.mandal}</dd></div>
              <div><dt className="inline font-semibold">Valid till: </dt><dd className="inline">{formatDate(row.m.validTill)}</dd></div>
            </dl>
          </>
        )}
        <p className="mt-4 text-[11px] text-slate-400">Verified live from association records. No private details are shown.</p>
      </div>
    </div>
  );
}
