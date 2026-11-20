import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  districts, mandals, membershipPlans, productCategories, roles, welfareSchemes, associationSettings,
} from "@/db/schema";
import { ROLE_DEFS } from "@/constants/roles";
import { slugify } from "@/lib/utils";

/** Reference/configuration data only (no members, orders or payments). Idempotent. */
const GEO: Record<string, string[]> = {
  Anantapur: ["Anantapur", "Rapthadu", "Tadipatri", "Guntakal", "Gooty", "Uravakonda", "Kalyandurg"],
  "Sri Sathya Sai": ["Hindupur", "Puttaparthi", "Dharmavaram", "Penukonda", "Kadiri", "Madakasira", "Lepakshi"],
  Kurnool: ["Kurnool", "Adoni", "Yemmiganur", "Alur", "Pattikonda", "Kodumur"],
  Nandyal: ["Nandyal", "Atmakur", "Dhone", "Banaganapalle", "Allagadda"],
  "YSR Kadapa": ["Kadapa", "Proddatur", "Jammalamadugu", "Pulivendula", "Badvel", "Mydukur"],
  Annamayya: ["Rayachoti", "Madanapalle", "Rajampet", "Pileru", "Thamballapalle"],
  Chittoor: ["Chittoor", "Punganur", "Palamaner", "Kuppam", "Nagari"],
  Tirupati: ["Tirupati Urban", "Srikalahasti", "Puttur", "Venkatagiri", "Gudur"],
};

const CATEGORIES: Record<string, string[]> = {
  "Mechanic Tools": ["Hand Tools", "Spanners and Wrenches", "Screwdrivers", "Pliers and Cutters", "Socket Sets", "Engine Repair Tools", "Clutch and Brake Tools"],
  "Workshop Equipment": ["Vehicle Lifting Equipment", "Diagnostic Tools", "OBD Scanners", "Electrical Testing Equipment", "Multimeters", "Battery Chargers", "Soldering Equipment"],
  "Two-Wheeler Spare Parts": ["Brake Pads and Shoes", "Clutch Plates", "Cables and Levers", "Filters", "Bearings", "Chains and Sprockets"],
  "Lubricants and Workshop Consumables": [],
  "Safety Equipment": ["Gloves and Protective Wear"],
  "Cleaning Materials": [],
  "Other Accessories": [],
};

const SCHEMES: Array<[string, string]> = [
  ["Accident Assistance", "accident"],
  ["Medical Assistance", "medical"],
  ["Death Benefit", "death"],
  ["Emergency Financial Assistance", "emergency"],
  ["Disability Assistance", "disability"],
  ["Children's Education Assistance", "education"],
  ["Family Support", "family"],
  ["Retirement Assistance", "retirement"],
];

let seeded: Promise<void> | null = null;

export function ensureSeed() {
  if (!seeded) {
    seeded = run().catch((e) => {
      seeded = null;
      throw e;
    });
  }
  return seeded;
}

async function run() {
  await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(7003)`);
    const [done] = await tx.select().from(associationSettings).where(eq(associationSettings.key, "seeded")).limit(1);
    if (done?.value === true) return;
    for (const r of ROLE_DEFS) {
      await tx
        .insert(roles)
        .values({ key: r.key, name: r.name, description: r.description, scope: r.scope, level: r.level, permissions: r.permissions, isSystem: true })
        .onConflictDoNothing();
    }

    const [{ d }] = await tx.select({ d: sql<number>`count(*)::int` }).from(districts);
    if (d === 0) {
      let i = 0;
      for (const [name, ms] of Object.entries(GEO)) {
        const [row] = await tx.insert(districts).values({ name, sortOrder: i++ }).returning();
        await tx.insert(mandals).values(ms.map((m) => ({ districtId: row.id, name: m })));
      }
    }

    const [{ c }] = await tx.select({ c: sql<number>`count(*)::int` }).from(productCategories);
    if (c === 0) {
      let i = 0;
      for (const [parent, kids] of Object.entries(CATEGORIES)) {
        const [p] = await tx.insert(productCategories).values({ name: parent, slug: slugify(parent), sortOrder: i++ }).returning();
        let j = 0;
        for (const k of kids) {
          await tx.insert(productCategories).values({ name: k, slug: slugify(k), parentId: p.id, sortOrder: j++ }).onConflictDoNothing();
        }
      }
    }

    const [{ s }] = await tx.select({ s: sql<number>`count(*)::int` }).from(welfareSchemes);
    if (s === 0) {
      await tx.insert(welfareSchemes).values(
        SCHEMES.map(([name, category]) => ({ name, category, approvalLevels: ["welfare_officer"], description: `${name} for association members.` })),
      );
    }

    const [{ p }] = await tx.select({ p: sql<number>`count(*)::int` }).from(membershipPlans);
    if (p === 0) {
      // Fees are intentionally 0: the Main Admin configures real prices under Plans & Cards.
      await tx.insert(membershipPlans).values({ name: "Standard Membership", validityMonths: 12 });
    }

    await tx.insert(associationSettings).values({ key: "seeded", value: true }).onConflictDoNothing();
  });
}
