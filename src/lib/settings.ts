import { cache } from "react";
import { db } from "@/db";
import { associationSettings } from "@/db/schema";

export const SETTING_DEFAULTS = {
  associationName: "Rayalaseema Two-Wheeler Mechanics Welfare Seva",
  shortName: "R2M CONNECT",
  tagline: "United Mechanics • Stronger Welfare • Better Future",
  contactPhone: "",
  contactEmail: "",
  contactAddress: "",
  presidentName: "President",
  presidentSignatureUrl: "",
  membershipPrefix: "R2M",
  paymentPolicy: "after_approval" as "before_approval" | "after_approval",
  deliveryChargePaise: 5000,
  freeDeliveryAbovePaise: 100000,
  codEnabled: false,
  pickupEnabled: true,
  commissionPerRegistrationPaise: 0,
  reminderDays: "30,15,7",
  maintenanceMode: false,
  terms:
    "By using R2M CONNECT you agree to follow the association's by-laws, provide accurate information, keep your login credentials private, and use the platform only for lawful association activities. Membership fees are non-transferable. Shop orders are subject to the return and refund policy shown at checkout. The association may suspend accounts that violate these terms.",
  privacy:
    "R2M CONNECT collects your name, contact details, workshop details, photograph and uploaded documents only to manage your association membership, welfare services and shop orders. Identity documents are stored privately and visible only to authorized association staff. Your phone number is never shown publicly unless you opt in to the mechanic directory or blood donor network. We do not sell personal data.",
};
export type Settings = typeof SETTING_DEFAULTS;

export const getSettings = cache(async (): Promise<Settings> => {
  const rows = await db.select().from(associationSettings);
  const out: Record<string, unknown> = { ...SETTING_DEFAULTS };
  for (const r of rows) if (r.key in SETTING_DEFAULTS) out[r.key] = r.value;
  return out as Settings;
});

export async function saveSetting(key: keyof Settings, value: unknown) {
  await db
    .insert(associationSettings)
    .values({ key, value })
    .onConflictDoUpdate({ target: associationSettings.key, set: { value } });
}
