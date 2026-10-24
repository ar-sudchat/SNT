#!/usr/bin/env bash
# Copy ALL data from Neon Postgres into the new self-hosted Postgres.
#
# Order (important):
#   1. Deploy only the "postgres" service (or the whole stack, then STOP backend)
#      so the target DB is EMPTY.
#   2. Run this script -> restores Neon schema + data.
#   3. Start backend: its `prisma db push` sees the restored tables already in
#      sync and only ADDS the new tables (AiConversation, AiMessage). Additive,
#      no data loss. (If backend ran first on the empty DB, --clean below drops
#      those tables and they get recreated on next backend start — also fine.)
#
# Usage A (target reachable from where you run this, e.g. SSH tunnel):
#   NEON_URL='postgresql://...neon.tech/db?sslmode=require' \
#   TARGET_URL='postgresql://kruscan:PW@127.0.0.1:5432/kruscan' \
#   ./migrate-from-neon.sh
#
# Usage B (run ON the VPS, DB not exposed -> restore via docker exec):
#   NEON_URL='...' PG_CONTAINER=<postgres container name from `docker ps`> \
#   ./migrate-from-neon.sh
#   (uses POSTGRES_USER/POSTGRES_DB inside the container)
#
# Neon is only read (pg_dump). Secrets come from env only — never hard-code.
set -euo pipefail

: "${NEON_URL:?set NEON_URL}"
PG_CONTAINER="${PG_CONTAINER:-}"
if [[ -z "$PG_CONTAINER" ]]; then : "${TARGET_URL:?set TARGET_URL (or PG_CONTAINER)}"; fi

DUMP="${DUMP_FILE:-kruscan-neon-$(date +%Y%m%d-%H%M%S).dump}"
umask 077   # dump contains personal data (PDPA) -> owner-only

die() { echo "ERROR: $*" >&2; exit 1; }
command -v pg_dump >/dev/null || die "pg_dump not found (install postgresql-client-16+)"
command -v psql    >/dev/null || die "psql not found"

major() { "$1" --version | sed -E 's/[^0-9]*([0-9]+).*/\1/'; }
client_v=$(major pg_dump)
server_v=$(psql "$NEON_URL" -Atc "show server_version_num" | cut -c1-2)
echo "pg_dump client v$client_v, Neon server v$server_v"
(( client_v >= server_v )) || die "pg_dump ($client_v) older than Neon server ($server_v); install a newer client"

# Target helpers -------------------------------------------------------------
if [[ -n "$PG_CONTAINER" ]]; then
  docker inspect "$PG_CONTAINER" >/dev/null || die "container $PG_CONTAINER not found"
  tpsql() { docker exec -i "$PG_CONTAINER" sh -c 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" "$@"' sh "$@"; }
  trestore() { docker exec -i "$PG_CONTAINER" sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" "$@"' sh "$@"; }
  target_desc="docker container $PG_CONTAINER"
else
  tpsql() { psql -v ON_ERROR_STOP=1 "$TARGET_URL" "$@"; }
  trestore() { pg_restore -d "$TARGET_URL" "$@"; }
  target_desc="${TARGET_URL%%\?*}"; target_desc="${target_desc/:*@/:***@}"
fi

[[ "$NEON_URL" != "${TARGET_URL:-}" ]] || die "NEON_URL and TARGET_URL are identical"
if [[ -z "$PG_CONTAINER" && "$TARGET_URL" == *neon.tech* ]]; then die "TARGET_URL points at Neon — refusing"; fi

# 1. Dump --------------------------------------------------------------------
echo "==> Dumping Neon -> $DUMP"
pg_dump "$NEON_URL" --no-owner --no-acl --format=custom --file="$DUMP"
ls -lh "$DUMP"

# 2. Confirm target ----------------------------------------------------------
echo
echo "Target: $target_desc"
echo "Existing tables in target:"
tpsql -Atc "select count(*) from pg_tables where schemaname='public'"
echo "pg_restore --clean will DROP and recreate every table from the dump in this target."
read -r -p "Type 'restore' to continue: " ans
[[ "$ans" == "restore" ]] || die "aborted"

# 3. Restore -----------------------------------------------------------------
echo "==> Restoring"
# --single-transaction: all-or-nothing. Re-running is safe (clean + if-exists).
trestore --clean --if-exists --no-owner --no-acl --single-transaction --exit-on-error < "$DUMP"

# 4. Verify row counts -------------------------------------------------------
count_sql="select format('select %L as t, count(*) as n from public.%I', tablename, tablename) from pg_tables where schemaname='public' order by tablename"
counts() { # $1 = runner
  local q; q=$("$@" -Atc "$count_sql" | paste -sd'|' - | sed 's/|/ union all /g')
  [[ -n "$q" ]] && "$@" -AtF' ' -c "$q order by 1"
}
neon_psql() { psql -v ON_ERROR_STOP=1 "$NEON_URL" "$@"; }
counts neon_psql | sort > "$DUMP.neon.txt"
counts tpsql      | sort > "$DUMP.target.txt"

echo
printf '%-28s %10s %10s  %s\n' TABLE NEON TARGET STATUS
bad=0
while read -r t n; do
  m=$(awk -v t="$t" '$1==t{print $2}' "$DUMP.target.txt")
  st=OK; [[ "$n" == "${m:-x}" ]] || { st=MISMATCH; bad=1; }
  printf '%-28s %10s %10s  %s\n' "$t" "$n" "${m:--}" "$st"
done < "$DUMP.neon.txt"
rm -f "$DUMP.neon.txt" "$DUMP.target.txt"

# Reset sequences? pg_dump restores setval() for serial/identity columns already.
echo
if (( bad )); then die "row counts differ — do NOT switch over; investigate"; fi
echo "All row counts match."
echo "Next: start/redeploy the backend (prisma db push adds AiConversation/AiMessage)."
echo "Dump kept at $DUMP — store it encrypted or delete it (personal data)."
