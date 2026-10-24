# SaaS migration: adding tenantId to production (2-step)

> Concept note (2026-10-24): a tenant is now a **group** (not a school). The existing single deployment becomes the first group; "school name" below just seeds the group name. See docs/SAAS-DESIGN.md.

The container runs `npx prisma db push --skip-generate && node server.js` on start.
The final `schema.prisma` has `tenantId String` (required) on every tenant model. Pushing it
straight onto a database with existing rows **fails** (required column, no default), so the
first production rollout must be expand -> backfill -> contract.

## Step 1: expand (tenantId nullable)

Build an expand schema from the final one (only the `tenantId`/`tenant` lines change):

```sh
cd backend
sed -E 's/^(  tenantId +)String$/\1String?/; s/^(  tenant +)Tenant( +)@relation/\1Tenant?\2@relation/' \
  prisma/schema.prisma > prisma/expand.tmp.prisma
npx prisma db push --schema prisma/expand.tmp.prisma     # adds Tenant/Membership/Invite/AuditLog + nullable tenantId
npx prisma generate --schema prisma/expand.tmp.prisma
```

`db push` also swaps the old single-column uniques (`studentCode`, `className`, ...) for
`@@unique([tenantId, ...])`. Existing data is unique per column, so no data is lost; Prisma may
still ask for `--accept-data-loss` when dropping the old unique index.

## Step 2: backfill

```sh
SCHOOL_NAME="ชื่อโรงเรียน" node scripts/backfillTenant.js
```

Creates tenant `snt` (name from `SCHOOL_NAME`, else "โรงเรียนแรก"), sets `tenantId` on every row
where it is NULL, and creates a Membership per User (ADMIN->OWNER, TEACHER->TEACHER,
STUDENT->STUDENT). Idempotent; run it again until every table reports `0 row(s) set`.

## Step 3: contract (tenantId required)

```sh
rm prisma/expand.tmp.prisma
npx prisma db push        # final schema; succeeds only when no NULL tenantId is left
```

After that, normal deploys (container start `db push`) are no-ops.

## On Coolify

Run steps 1-2 once from a one-off shell in the backend container (or locally with
`DATABASE_URL` pointed at prod, after a `pg_dump` backup), **before** deploying the image whose
start command pushes the final schema. Otherwise the container start fails at `db push` and the
old container keeps serving.

## Rollback

Backup first (`pg_dump`). The expand step is additive except for the unique-index swap; to roll
back, redeploy the previous image and restore the old unique indexes from the backup.

## Step 4: Row Level Security (database-level isolation)

Files: `backend/prisma/rls.sql` (idempotent), `backend/scripts/applyRls.js`, wiring in `backend/config/database.js`.

- Policies on the 13 tenant tables (`TENANT_MODELS`): ENABLE + FORCE RLS, `tenant_isolation`
  (`"tenantId" = current_setting('app.tenant_id', true)`, USING + WITH CHECK) and `tenant_bypass`
  (`current_setting('app.bypass_rls', true) = 'on'`). `User`, `Tenant`, `Membership` stay global (auth reads them before a tenant is known).
- App wiring is behind `RLS_ENABLED=1` (default off). When on, every tenant-model operation runs as
  `$transaction([SELECT set_config('app.tenant_id', tid, true), query])`; `withoutTenant()` sets `app.bypass_rls` instead.
  GUCs are transaction-local, so pooled connections never carry a tenant. No GUC = 0 rows (fail closed).
- **Superusers and roles with BYPASSRLS ignore RLS even with FORCE.** It only protects when the app connects
  as a plain role. FORCE is kept because today the app role owns the tables.

Rollout (only after Step 3, with tenantId NOT NULL everywhere):
1. Deploy code with `RLS_ENABLED=1` first (harmless while policies are absent; adds 1 extra statement + tx per query).
2. Apply policies: `node scripts/applyRls.js` (it verifies `relrowsecurity`+`relforcerowsecurity` on every table, exits 1 otherwise).
   On Coolify, chain it in the pre-deploy/start command after schema sync, e.g.
   `npx prisma db push --skip-generate && node scripts/applyRls.js && node server.js` (Dockerfile unchanged).
3. Create a non-superuser app role (`kruscan_app`, NOBYPASSRLS, DML grants only) and point `DATABASE_URL` at it;
   keep the owner role in `DIRECT_URL` for migrations/applyRls. Until then RLS is not enforced in production.
4. Scripts using `basePrisma` directly (backfill, test fixtures) must run before step 2, as the owner role via
   `$transaction([set_config('app.bypass_rls','on',true), ...])`, or as an ops role with BYPASSRLS.

Rollback: `node scripts/applyRls.js --disable` (NO FORCE + DISABLE on all tables), then `RLS_ENABLED=0`.
Never turn the flag off while policies are active for a non-owner role: every tenant query would return 0 rows.

Perf: each scoped query becomes BEGIN / set_config / query / COMMIT (about 3 extra round-trips, ~0.3-1 ms locally).
Policy predicate matches the existing `@@index([tenantId])`; check `EXPLAIN` on hot list queries after enabling.

Verify: `node --test tests/rls.test.js` (skips without a local DB; creates role `kruscan_rls_test` to test as non-superuser).
