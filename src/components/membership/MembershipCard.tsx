import { LogoMark } from "@/components/shared/Logo";
import { formatDate } from "@/lib/utils";

export type CardData = {
  name: string;
  membershipNo: string | null;
  garage: string | null;
  district: string | null;
  mandal: string | null;
  validTill: string | null;
  photoUrl: string | null;
  status: string; // active | expired | suspended | pending | cancelled
  qr: string;
  issuedAt: Date | null;
  association: string;
  presidentName: string;
  signatureUrl: string | null;
  tagline: string;
};

const STATUS: Record<string, { text: string; cls: string }> = {
  active: { text: "Active Member", cls: "bg-green-600" },
  expired: { text: "Expired", cls: "bg-red-600" },
  suspended: { text: "Suspended", cls: "bg-amber-600" },
  cancelled: { text: "Cancelled", cls: "bg-red-700" },
  pending: { text: "Pending", cls: "bg-slate-500" },
};

/** Printed-card style layout: curved navy header/footer, photo left, QR + status + signature at the bottom. */
export function MembershipCard({ c }: { c: CardData }) {
  const st = STATUS[c.status] ?? STATUS.pending;
  return (
    <div
      id="member-card"
      className="print-area relative mx-auto w-full max-w-[360px] overflow-hidden rounded-2xl border border-slate-200 bg-[#f3f8ff] shadow-lg"
      style={{ aspectRatio: "360 / 560" }}
    >
      {/* top wave */}
      <svg className="absolute inset-x-0 top-0 w-full" viewBox="0 0 360 90" preserveAspectRatio="none" aria-hidden>
        <path d="M0 0H360V40C300 80 240 20 170 48C100 76 50 60 0 70Z" fill="#0756B5" />
        <path d="M0 0H360V22C290 60 230 4 160 30C90 56 40 40 0 50Z" fill="#123B78" />
        <path d="M0 62C50 52 100 78 170 56" stroke="#F59E0B" strokeWidth="2.5" fill="none" />
      </svg>
      {/* bottom wave */}
      <svg className="absolute inset-x-0 bottom-0 w-full" viewBox="0 0 360 80" preserveAspectRatio="none" aria-hidden>
        <path d="M0 30C60 5 110 50 190 28C260 8 310 20 360 6V80H0Z" fill="#0756B5" />
        <path d="M0 48C70 26 120 64 200 44C270 28 320 40 360 28V80H0Z" fill="#123B78" />
      </svg>

      <div className="relative flex h-full flex-col px-5 pb-16 pt-3">
        <div className="mb-1 flex items-center justify-center gap-2 pt-1">
          <span className="rounded-full bg-white p-0.5 shadow"><LogoMark size={34} /></span>
          <p className="text-[10px] font-semibold leading-tight text-white">R2M CONNECT</p>
        </div>
        <div className="mt-5 rounded-xl bg-white/90 px-2 py-1.5 text-center shadow-sm">
          <p className="text-[13px] font-extrabold leading-tight text-navy">{c.association}</p>
        </div>
        <div className="mx-auto mt-2 w-[85%] rounded-full bg-gradient-to-r from-navy to-royal py-1 text-center text-sm font-bold tracking-wide text-white shadow">
          MEMBERSHIP CARD
        </div>

        <div className="mt-3 flex gap-3">
          <div className="h-[128px] w-[104px] shrink-0 overflow-hidden rounded-lg border border-slate-300 bg-slate-100 shadow-sm">
            {c.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={c.photoUrl} alt={c.name} className="h-full w-full object-cover" crossOrigin="anonymous" />
            ) : (
              <div className="flex h-full items-center justify-center text-4xl font-bold text-slate-300">{c.name[0]}</div>
            )}
          </div>
          <div className="min-w-0 flex-1 text-[12px] leading-snug text-ink">
            <p className="break-words text-lg font-extrabold leading-tight text-navy">{c.name}</p>
            <p className="mt-1"><b>ID</b> : <span className="font-semibold">{c.membershipNo ?? "Pending"}</span></p>
            <p><b>Garage</b> : {c.garage ?? "—"}</p>
            <p><b>Category</b> : Mechanic</p>
            <p><b>District</b> : {c.district ?? "—"}</p>
            <p><b>Mandal</b> : {c.mandal ?? "—"}</p>
            <p><b>Valid Till</b> : <span className="font-semibold">{formatDate(c.validTill)}</span></p>
          </div>
        </div>

        <div className="mt-4 flex items-end justify-between gap-2">
          <div className="rounded-lg bg-white p-1 shadow-sm">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={c.qr} alt="Verification QR code" className="h-[96px] w-[96px]" />
          </div>
          <div className="flex flex-1 flex-col items-center gap-1 pb-1">
            <span className={`rounded-full px-3 py-1 text-[11px] font-bold text-white ${st.cls}`}>{st.text}</span>
            <p className="text-[9px] text-slate-500">Issued {formatDate(c.issuedAt)}</p>
          </div>
          <div className="w-[100px] text-center">
            {c.signatureUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={c.signatureUrl} alt="President signature" className="mx-auto h-9 object-contain" crossOrigin="anonymous" />
            ) : (
              <p className="h-9 text-xl italic text-navy" style={{ fontFamily: "'Brush Script MT','Segoe Script',cursive" }}>{c.presidentName}</p>
            )}
            <div className="border-t border-slate-700 pt-0.5 text-[10px] font-semibold">President</div>
          </div>
        </div>
      </div>
      <p className="absolute inset-x-0 bottom-2 text-center text-[9px] font-medium tracking-wide text-white">{c.tagline}</p>
    </div>
  );
}
