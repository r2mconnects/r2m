// Bootstrap the server-session application, not the alternative browser API policies.
import 'dotenv/config';
import pg from 'pg';
import { readFile } from 'node:fs/promises';

if (!process.env.DATABASE_URL) throw new Error('Set server-only DATABASE_URL before initializing the database.');
const schema = await readFile(new URL('../supabase/migrations/0001_schema.sql', import.meta.url), 'utf8');
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  await client.query('begin');
  await client.query('set local search_path to public');
  await client.query('select pg_advisory_xact_lock(7002)');
  await client.query(schema);
  const { rows } = await client.query("select rolname from pg_roles where rolname in ('anon','authenticated')");
  for (const [, name] of schema.matchAll(/CREATE TABLE IF NOT EXISTS "(\w+)"/g)) {
    await client.query(`alter table public."${name}" enable row level security`);
    for (const role of ['public', ...rows.map(r => r.rolname)]) {
      await client.query(`revoke all on public."${name}" from ${role}`);
    }
  }
  await client.query('commit');
  console.log('R2M schema ready. Open /setup to initialize reference data and create the administrator.');
} catch (error) {
  await client.query('rollback');
  throw error;
} finally {
  await client.end();
}
