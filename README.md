# SLAA Registration

Public registration for coaches and athletes of Sri Lanka Athletics, with an admin area for staff.
Built from `IMPLEMENTATION_PLAN.md`; database rules live in `db/` (the original schema is `db/001_schema.sql`, unchanged).

## Local development

Needs Node 20+ and PostgreSQL 16.

```bash
npm install
createdb slaa_dev && scripts/db-apply.sh postgres://localhost/slaa_dev
psql postgres://localhost/slaa_dev -c "ALTER ROLE slaa_app PASSWORD 'devpass'"
cp .env.example .env.local      # then set DATABASE_URL, SESSION_SECRET, DEV_ADMIN_EMAIL
npm run dev                     # http://localhost:3000, admin at /admin
```

With `DEV_ADMIN_EMAIL` set, `/admin` skips the magic link in development only.

## Tests

```bash
createdb slaa_test && scripts/db-apply.sh postgres://localhost/slaa_test
psql postgres://localhost/slaa_test -c "ALTER ROLE slaa_app PASSWORD 'devpass'"
npm test            # unit + API + admin (Vitest)
npm run test:e2e    # Playwright at 375px width; needs internet for Turnstile test keys
```

## Deploying (Supabase + Vercel)

1. **Supabase**: create a project in `ap-southeast-1` (Singapore). In the SQL editor run, in order,
   `db/001_schema.sql`, `db/002_app_additions.sql`, `db/003_admin_delete.sql`, `db/004_athlete_details.sql`, `db/seed_reference.sql`, then
   `ALTER ROLE slaa_app PASSWORD '<strong password>';`
   The `slaa` schema is not exposed through Supabase's REST API, so the anon key cannot read it.
2. **Supabase Auth**: Authentication → URL configuration: set the Site URL to the live domain and add
   `https://<domain>/auth/callback` as a redirect URL.
3. **Cloudflare Turnstile**: create a widget for the domain and copy the site key and secret.
4. **Vercel**: import the repo and set the variables from `.env.example`. Use the transaction pooler URL
   (port 6543) with user `slaa_app.<project-ref>`. Do **not** set `DEV_ADMIN_EMAIL`.
5. **Import the Google Form responses**: export the sheet as CSV, then
   `IMPORT_DATABASE_URL=<owner connection> npm run import:sheet -- responses.csv --dry-run`;
   review the summary and `import_errors.csv`, then run it again without `--dry-run`.
6. **QR code**: `npm run qr -- https://<domain>/` writes `slaa-register-qr.png`.

## Meet day

Many phones at a stadium share a carrier IP address. If people report "Too many requests",
raise `RATE_LIMIT_*` in Vercel and redeploy.
