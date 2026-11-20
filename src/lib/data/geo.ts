import { asc, eq } from "drizzle-orm";
import { cache } from "react";
import { db } from "@/db";
import { districts, mandals } from "@/db/schema";

export const getDistricts = cache(async (onlyActive = true) => {
  const q = db.select().from(districts);
  const rows = await (onlyActive ? q.where(eq(districts.active, true)) : q).orderBy(asc(districts.sortOrder), asc(districts.name));
  return rows;
});

export const getMandals = cache(async (onlyActive = true) => {
  const q = db
    .select({ id: mandals.id, name: mandals.name, districtId: mandals.districtId, active: mandals.active, districtName: districts.name })
    .from(mandals)
    .innerJoin(districts, eq(districts.id, mandals.districtId));
  const rows = await (onlyActive ? q.where(eq(mandals.active, true)) : q).orderBy(asc(districts.name), asc(mandals.name));
  return rows;
});
