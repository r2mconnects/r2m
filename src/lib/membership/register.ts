import { and, eq, inArray, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { memberDocuments, members, passwordResets, userRoles, users, roles } from "@/db/schema";
import { hashPassword } from "@/lib/auth/password";
import { randomToken, sha256, intOrNull, str, strOrNull } from "@/lib/utils";
import { fileUrl, saveUpload } from "@/lib/uploads";
import { notifyMany } from "@/lib/notifications/notify";
import { audit } from "@/lib/audit";
import { getPlan } from "@/lib/membership/membership";

export const registrationSchema = z.object({
  fullName: z.string().min(2, "Enter the full name"),
  mobile: z.string().regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit mobile number"),
  email: z.string().email("Enter a valid email").nullable(),
  districtId: z.string().uuid("Select a district"),
  mandalId: z.string().uuid("Select a mandal"),
  address: z.string().min(3, "Enter the address"),
  workshopName: z.string().min(2, "Enter the workshop / garage name"),
});

/** Notify main admins and in-scope staff who can review applications. */
async function notifyReviewers(districtId: string, mandalId: string, title: string, body: string) {
  const rows = await db
    .select({ userId: userRoles.userId })
    .from(userRoles)
    .innerJoin(roles, eq(roles.key, userRoles.roleKey))
    .where(
      and(
        eq(userRoles.active, true),
        or(
          eq(userRoles.roleKey, "main_admin"),
          and(inArray(roles.scope, ["global"]), sql`${roles.permissions} -> 'applications' ? 'approve'`),
          eq(userRoles.districtId, districtId),
          eq(userRoles.mandalId, mandalId),
        ),
      ),
    );
  await notifyMany(Array.from(new Set(rows.map((r) => r.userId))), title, body, "/admin/applications", "registration");
}

export async function createMember(
  fd: FormData,
  opts: { agentId?: string | null; password?: string } = {},
): Promise<{ ok: true; memberId: string; ref: string; activationToken?: string } | { ok: false; error: string }> {
  const parsed = registrationSchema.safeParse({
    fullName: str(fd, "fullName"),
    mobile: str(fd, "mobile"),
    email: strOrNull(fd, "email"),
    districtId: str(fd, "districtId"),
    mandalId: str(fd, "mandalId"),
    address: str(fd, "address"),
    workshopName: str(fd, "workshopName"),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const v = parsed.data;

  const dup = await db
    .select({ id: users.id })
    .from(users)
    .where(v.email ? or(eq(users.mobile, v.mobile), eq(users.email, v.email.toLowerCase())) : eq(users.mobile, v.mobile))
    .limit(1);
  if (dup.length) return { ok: false, error: "An account with this mobile number or email already exists." };

  let photo: string | null = null;
  let docName: string | null = null;
  try {
    photo = await saveUpload(fd.get("photo"), "image");
    docName = await saveUpload(fd.get("idProof"), "document");
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }

  const plan = await getPlan();
  const password = opts.password ?? randomToken(12);
  const passwordHash = await hashPassword(password);

  try {
    const out = await db.transaction(async (tx) => {
      const [u] = await tx
        .insert(users)
        .values({
          fullName: v.fullName,
          mobile: v.mobile,
          email: v.email?.toLowerCase() ?? null,
          passwordHash,
          photoUrl: fileUrl(photo),
          status: opts.password ? "active" : "invited",
        })
        .returning();
      await tx.insert(userRoles).values({ userId: u.id, roleKey: "member" });
      const r = await tx.execute(sql`select nextval('application_seq') as n`);
      const ref = `APP-${new Date().getFullYear()}-${String((r.rows[0] as { n: string }).n).padStart(5, "0")}`;
      const [m] = await tx
        .insert(members)
        .values({
          userId: u.id,
          applicationRef: ref,
          fullName: v.fullName,
          mobile: v.mobile,
          email: v.email?.toLowerCase() ?? null,
          dob: strOrNull(fd, "dob"),
          photoUrl: fileUrl(photo),
          address: v.address,
          village: strOrNull(fd, "village"),
          districtId: v.districtId,
          mandalId: v.mandalId,
          workshopName: v.workshopName,
          workshopAddress: strOrNull(fd, "workshopAddress"),
          experienceYears: intOrNull(fd, "experienceYears"),
          specialization: strOrNull(fd, "specialization"),
          emergencyName: strOrNull(fd, "emergencyName"),
          emergencyPhone: strOrNull(fd, "emergencyPhone"),
          nomineeName: strOrNull(fd, "nomineeName"),
          nomineeRelation: strOrNull(fd, "nomineeRelation"),
          directoryOptIn: fd.get("directoryOptIn") === "on",
          agentId: opts.agentId ?? null,
          planId: plan?.id ?? null,
        })
        .returning();
      if (docName) await tx.insert(memberDocuments).values({ memberId: m.id, docType: "id_proof", fileName: docName, originalName: (fd.get("idProof") as File).name });
      let activationToken: string | undefined;
      if (!opts.password) {
        activationToken = randomToken(24);
        await tx.insert(passwordResets).values({
          userId: u.id, tokenHash: sha256(activationToken), purpose: "activation", expiresAt: new Date(Date.now() + 7 * 86400000),
        });
      }
      return { memberId: m.id, ref, activationToken };
    });
    await audit(opts.agentId ?? null, "member.registered", "member", out.memberId, { ref: out.ref, byAgent: Boolean(opts.agentId) });
    await notifyReviewers(v.districtId, v.mandalId, "New membership application", `${v.fullName} (${out.ref}) has applied for membership.`);
    return { ok: true, ...out };
  } catch (e) {
    console.error(e);
    return { ok: false, error: "Could not save the application. The mobile number may already be registered." };
  }
}
