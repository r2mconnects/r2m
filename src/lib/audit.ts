import { db } from "@/db";
import { auditLogs } from "@/db/schema";

export async function audit(
  userId: string | null,
  action: string,
  entity?: string,
  entityId?: string | null,
  details?: Record<string, unknown>,
) {
  try {
    await db.insert(auditLogs).values({ userId, action, entity, entityId: entityId ?? undefined, details });
  } catch (e) {
    console.error("audit failed", e);
  }
}
