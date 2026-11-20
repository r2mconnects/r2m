// Protected bootstrap: create the first Main Admin from the server shell.
//   ADMIN_NAME="..." ADMIN_EMAIL="..." ADMIN_PASSWORD="..." DATABASE_URL=... node scripts/create-admin.mjs
// Refuses to run if a Main Admin already exists. Start the app once first so roles are seeded.
import pg from "pg";
import { randomBytes, scrypt } from "crypto";
import { promisify } from "util";

const { ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD, DATABASE_URL } = process.env;
if (!ADMIN_NAME || !ADMIN_EMAIL || !ADMIN_PASSWORD || !DATABASE_URL) {
  console.error("Set ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD and DATABASE_URL.");
  process.exit(1);
}
if (ADMIN_PASSWORD.length < 10) {
  console.error("Use a password of at least 10 characters.");
  process.exit(1);
}
const client = new pg.Client({ connectionString: DATABASE_URL });
await client.connect();
try {
  await client.query("begin");
  await client.query("select pg_advisory_xact_lock(7001)");
  const existing = await client.query("select 1 from user_roles where role_key = 'main_admin' limit 1");
  if (existing.rowCount) throw new Error("A Main Admin already exists.");
  const role = await client.query("select 1 from roles where key = 'main_admin'");
  if (!role.rowCount) throw new Error("Roles are not seeded yet. Start the app once, then re-run.");
  const salt = randomBytes(16).toString("hex");
  const hash = (await promisify(scrypt)(ADMIN_PASSWORD, salt, 64)).toString("hex");
  const u = await client.query(
    "insert into users (full_name, email, password_hash) values ($1, lower($2), $3) returning id",
    [ADMIN_NAME, ADMIN_EMAIL, `scrypt$${salt}$${hash}`],
  );
  await client.query("insert into user_roles (user_id, role_key) values ($1, 'main_admin')", [u.rows[0].id]);
  await client.query("insert into audit_logs (user_id, action, entity, entity_id) values ($1, 'setup.main_admin_created', 'user', $2)", [u.rows[0].id, String(u.rows[0].id)]);
  await client.query("commit");
  console.log("Main Admin created:", ADMIN_EMAIL);
} catch (e) {
  await client.query("rollback");
  console.error(e.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
