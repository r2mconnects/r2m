import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { districts, mandals, members, membershipCards } from "@/db/schema";
import { getSettings } from "@/lib/settings";
import { cardQr } from "@/lib/membership/card-generator";
import type { CardData } from "@/components/membership/MembershipCard";

export async function getMemberFull(id: string) {
  const [row] = await db
    .select({ m: members, district: districts.name, mandal: mandals.name })
    .from(members)
    .leftJoin(districts, eq(districts.id, members.districtId))
    .leftJoin(mandals, eq(mandals.id, members.mandalId))
    .where(eq(members.id, id));
  return row ?? null;
}

/** Builds real card data from a member record. Returns null until a card has been issued. */
export async function buildCard(memberId: string): Promise<{ card: CardData; link: string; cardStatus: string } | null> {
  const row = await getMemberFull(memberId);
  if (!row) return null;
  const [c] = await db.select().from(membershipCards).where(eq(membershipCards.memberId, memberId));
  if (!c) return null;
  const s = await getSettings();
  const qr = await cardQr(c.token);
  let status = row.m.status;
  if (c.status !== "active") status = c.status;
  return {
    link: qr.url,
    cardStatus: c.status,
    card: {
      name: row.m.fullName,
      membershipNo: row.m.membershipNo,
      garage: row.m.workshopName,
      district: row.district,
      mandal: row.mandal,
      validTill: row.m.validTill,
      photoUrl: row.m.photoUrl,
      status,
      qr: qr.dataUrl,
      issuedAt: c.issuedAt,
      association: s.associationName,
      presidentName: s.presidentName,
      signatureUrl: s.presidentSignatureUrl || null,
      tagline: s.tagline,
    },
  };
}

export async function activeMemberCount() {
  const r = await db.select({ id: members.id }).from(members).where(and(eq(members.status, "active")));
  return r.length;
}
