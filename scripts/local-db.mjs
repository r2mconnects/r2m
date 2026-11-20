// Isolated development database. Never reads or modifies the hosted database.
import EmbeddedPostgres from 'embedded-postgres';
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve, join } from 'node:path';

const root = resolve(process.env.R2M_DEV_DATA || '.data/dev');
mkdirSync(root, { recursive: true, mode: 0o700 });
const secret = join(root, 'password');
if (!existsSync(secret)) writeFileSync(secret, randomBytes(24).toString('hex'), { mode: 0o600, flag: 'wx' });
const password = readFileSync(secret, 'utf8');
const databaseDir = join(root, 'postgres');
const port = 55432;
const db = new EmbeddedPostgres({ databaseDir, user: 'postgres', password, port, persistent: true, initdbFlags: ['--encoding=UTF8'], authMethod: 'scram-sha-256', postgresFlags: ['-c', 'listen_addresses=127.0.0.1'] });
if (!existsSync(join(databaseDir, 'PG_VERSION'))) await db.initialise();
await db.start();
try {
  const url = `postgresql://postgres:${password}@127.0.0.1:${port}/postgres`;
  execFileSync(process.execPath, ['scripts/init-db.mjs'], { env: { ...process.env, DATABASE_URL: url }, stdio: 'inherit' });
  writeFileSync(join(root, 'database.env'), `DATABASE_URL=${url}\n`, { mode: 0o600 });
  console.log('Local schema ready. Use the generated database.env in your app environment.');
} catch (error) {
  await db.stop(); throw error;
}
