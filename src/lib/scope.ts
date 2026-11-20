import { eq, inArray, or, sql, type SQL } from "drizzle-orm";
import { members } from "@/db/schema";
import type { AuthCtx } from "@/lib/auth/session";

/** SQL condition limiting member rows to what this staff user may see. */
export function memberScope(ctx: AuthCtx): SQL | undefined {
  if (ctx.scope.global) return undefined;
  const parts: SQL[] = [];
  if (ctx.scope.districtIds.length) parts.push(inArray(members.districtId, ctx.scope.districtIds));
  if (ctx.scope.mandalIds.length) parts.push(inArray(members.mandalId, ctx.scope.mandalIds));
  if (ctx.scope.agent) parts.push(eq(members.agentId, ctx.user.id));
  if (!parts.length) return sql`false`;
  return or(...parts);
}

export function inMemberScope(
  ctx: AuthCtx,
  m: { districtId: string | null; mandalId: string | null; agentId: string | null },
) {
  if (ctx.scope.global) return true;
  if (m.districtId && ctx.scope.districtIds.includes(m.districtId)) return true;
  if (m.mandalId && ctx.scope.mandalIds.includes(m.mandalId)) return true;
  if (ctx.scope.agent && m.agentId === ctx.user.id) return true;
  return false;
}
