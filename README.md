# R2M CONNECT — Rayalaseema Two-Wheeler Mechanics Welfare Seva

*United Mechanics • Stronger Welfare • Better Future*

Private association platform: membership, digital ID cards, staff & agents, welfare, shop, news/events, reports.
Built with Next.js 16 (App Router), TypeScript, Tailwind CSS, Drizzle ORM + PostgreSQL, Zod, Recharts, QR/PDF generation.

## What is implemented

| Area | Status |
|---|---|
| Auth (login, register, forgot/reset, activation, sessions, rate-limit, logout) | Built-in secure sessions (scrypt, httpOnly cookie, hashed session ids) |
| Main Admin bootstrap | One-time `/setup` page (optional `ADMIN_SETUP_TOKEN`) or `scripts/create-admin.mjs`; disables itself after first admin |
| Roles & permissions | 12 roles, 23 modules × 8 actions, editable matrix, geographic scope (district / mandal / agent) enforced server-side |
| Members | Self-registration, agent-assisted registration, review → preliminary approval → approval, server-generated membership no. |
| Membership card | Live from DB, QR (rotating token), PDF download, print, share, reissue, suspend, bulk-generate, `/verify/[token]` |
| Fees & renewals | Configurable plans, Razorpay order/verify/webhook (server-side signature checks), manual collections with maker-checker verification, receipts, renewal calc, reminders |
| Staff | Create/invite, role/area changes, suspend, revoke sessions, reset links, agent performance & optional commission |
| News / Events | Audience targeting, scheduling, attachments, registration, attendance, CSV export |
| Shop | Categories/brands, products, images, stock ledger, cart, coupons, checkout (idempotent), orders, invoices (GST), returns, refunds |
| Welfare | Configurable review levels → committee approval → finance disbursement (separate permissions), history |
| Emergency, Blood donors, Find a mechanic | Done (SOS is clearly "submitted" vs "acknowledged"; donor phone numbers never public) |
| Reports | Live charts + CSV exports (permission-checked & audited) |
| Languages | English / Telugu for navigation and key screens (cookie + profile) |

## Honest notes about integrations

* **Backend:** the sandbox/runtime for this build provides PostgreSQL, so the app runs on **Drizzle + Postgres** with its own session auth. The complete **Supabase** package (schema, functions, RLS, storage, seed) is in `supabase/migrations/` — run it manually in the Supabase SQL editor when you move to Supabase. The SQL was test-executed against a scratch Postgres with stubbed `auth`/`storage` schemas. Switching auth to Supabase Auth requires replacing `src/lib/auth/session.ts` (the bridge trigger is included, commented, in `0002`).
* **Razorpay:** fully wired but disabled until `RAZORPAY_KEY_ID/SECRET` are set; no payment is ever marked paid without a verified signature/webhook or an authorized staff verification.
* **OTP / SMS / WhatsApp / Email:** not simulated. In-app notifications work; external channels show "not configured" in the delivery log until keys are set (provider adapters still need to be connected in `src/lib/notifications/notify.ts`). Registration therefore verifies applicants through staff review rather than OTP.
* **Uploads:** stored on disk (`UPLOAD_DIR`, default `.data/uploads`). Photos/product images are served by unguessable names; ID/welfare documents are private and served only to the owner or authorized staff in scope. On serverless hosts use a persistent volume or move to Supabase Storage (buckets/policies in `0004`).
* **Logo:** a vector R2M CONNECT mark is rendered by `src/components/shared/Logo.tsx`. Replace it with your exact artwork there (and `public/icons/icon.svg`) if desired.
* Not included: villages table (village is free text), training courses/partners/offers tables, PDF reports (CSV only; use browser Print for PDF).

## Run a local preview without cloud credentials

With Node 22 and a non-root user, run `npm ci`, then `npm run db:local` in one terminal. This starts a loopback-only development PostgreSQL instance and initializes all 42 tables. Leave it running. In a second terminal:

```bash
set -a
. .data/dev/database.env
set +a
npm run dev
```

Open `/setup` to bootstrap your local administrator. Set `ADMIN_SETUP_TOKEN` before exposing the app to other people. Local data is separate from hosted Supabase and is not synchronized. Keep `.data/` private and outside version control. For hosted deployment, use the server environment described below instead of `db:local`.

## Setup

```bash
npm install
cp .env.example .env            # fill DATABASE_URL, APP_URL, Razorpay etc.
npm run db:init                 # create tables atomically; restrict direct API access
npm run build && npm start
```
1. Open the app → **Create the Main Admin** at `/setup` (or `ADMIN_NAME=… ADMIN_EMAIL=… ADMIN_PASSWORD=… node scripts/create-admin.mjs`).
2. Admin → **Plans & Cards**: set joining / renewal fees (seeded at ₹0 deliberately).
3. Admin → **Settings**: association details, president signature, payment sequence, shop settings.
4. Admin → **Staff → Add**: create district/mandal presidents, agents, finance & welfare officers; share the one-time activation link.
5. Add products, categories, news and events.

### Razorpay
Set `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`; add webhook `{APP_URL}/api/payments/webhook` (payment.captured, order.paid, payment.failed).

### Scheduled reminders
Call `GET /api/notifications/cron` daily with `Authorization: Bearer $CRON_SECRET` (Vercel Cron works), or press the button in Admin → Notifications.

## Connecting the app to hosted Supabase Postgres

In Supabase → Connect, copy the **session pooler** connection string for project `zambbztjjovdtuanemjr`. Set it as `DATABASE_URL` in the server environment (or `.env` for the setup commands), with the URL-encoded database password and TLS enabled. Use the database owner for initialization and a trusted server connection with access under RLS for runtime. Never put this URL in a `NEXT_PUBLIC_` variable. No Supabase API keys are required for this mode.

Run `npm run db:init` and set `ADMIN_SETUP_TOKEN` before deployment. The initializer completes all 42 tables, including any auth tables already provisioned. Visit `/setup` to seed roles, locations, categories, schemes and a membership plan, then create the first administrator. Check `/api/health` for DB connectivity, then verify login, member registration, staff review and logout using `tests/CHECKLIST.md`.

**Data flow:** browser form → Next.js server action → session/role and area checks → Drizzle transaction → Supabase Postgres. Account credentials and sessions stay server-side. Membership applications feed staff review; approved members proceed to fees/renewal and card issuance. Welfare reviews, payment verification and shop orders use their own tables and permissions.

## Alternative Supabase API package (not used by the server-session app)
`0001_schema.sql` → `0002_functions_triggers.sql` → `0003_rls.sql` → `0004_storage.sql` → `0005_seed.sql`.
All are non-destructive (IF NOT EXISTS / drop-policy-if-exists only). They never drop tables or data.

## Security model
* Every page, Server Action and route handler calls `requirePermission(module, action)`; staff data is filtered by `memberScope()`.
* Separation of duties: agents can't approve their own registrations; collectors can't verify their own collections; approvers can't disburse (Main Admin excepted, audited).
* Payments: signature verified server-side; transactions immutable; receipts sequential; shop and membership books separate.
* Passwords: scrypt; sessions hashed in DB; login rate-limit (5 / 15 min); suspending revokes sessions.
* Uploads: type/size validated; private documents authorized per request.

## Testing checklist
See `tests/CHECKLIST.md`.

## Deployment
Vercel/any Node host: set env vars, run `npm run db:init` once, `npm run build`. Persist `UPLOAD_DIR`. Set `NEXT_PUBLIC_APP_URL` to the public HTTPS origin (QR codes use it) and (behind HTTPS) keep secure cookies on.
