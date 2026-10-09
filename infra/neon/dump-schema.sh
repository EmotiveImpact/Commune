#!/usr/bin/env bash
# Writes infra/neon/schema.sql: the schema the migrations produce, with every
# function, view, policy and grant in full, so the current version of any of
# them can be read without a database. Run it after adding or changing a
# migration and commit the file with the migration:
#
#   infra/neon/dump-schema.sh            rewrites schema.sql
#   infra/neon/dump-schema.sh --check    fails if schema.sql is out of date (CI)
#
# It builds one disposable database the way the database tests build their
# stub database (tests/run-local.sh --create: the auth stand-ins, then every
# migration), dumps it without the stand-ins' auth and neon_auth schemas, and
# drops it again. Nothing else is touched.
#
# The connection comes from the usual PG* variables, as for run-local.sh: a
# loopback PostgreSQL 16 server and a local superuser, as in CI. The database's
# name starts with SQL_TEST_PREFIX (default commune_sqltest) and a random id.
# pg_dump must be version 16 too, so the file does not change with the tools
# that wrote it. The script uses PG_DUMP if it is set, then
# /usr/lib/postgresql/16/bin/pg_dump if it exists, then pg_dump on the PATH.
set -euo pipefail
export LC_ALL=C

usage() { echo "usage: dump-schema.sh [--check]" >&2; exit 2; }
check=0
if [ "$#" -gt 1 ]; then usage; fi
case "${1:-}" in
  "") ;;
  --check) check=1 ;;
  *) usage ;;
esac

here=$(cd "$(dirname "$0")" && pwd)
schema="$here/schema.sql"

# The same connection rules as run-local.sh, checked before connecting.
export PGHOST="${PGHOST:-127.0.0.1}" PGPORT="${PGPORT:-5432}"
case "$PGHOST" in
  127.0.0.1|localhost) ;;
  *) echo "dump-schema.sh: PGHOST must be 127.0.0.1 or localhost, not $PGHOST" >&2; exit 2 ;;
esac
for setting in PGHOSTADDR PGSERVICE PGSERVICEFILE; do
  if [ -n "${!setting:-}" ]; then
    echo "dump-schema.sh: unset $setting; it would take the connection somewhere other than PGHOST" >&2; exit 2
  fi
done

pg_dump="${PG_DUMP:-}"
if [ -z "$pg_dump" ]; then
  if [ -x /usr/lib/postgresql/16/bin/pg_dump ]; then pg_dump=/usr/lib/postgresql/16/bin/pg_dump; else pg_dump=pg_dump; fi
fi
if ! version=$("$pg_dump" --version 2>/dev/null | head -n 1); then
  echo "dump-schema.sh: could not run $pg_dump. Install the PostgreSQL 16 client tools or set PG_DUMP to their pg_dump." >&2; exit 2
fi
case "$version" in
  *"(PostgreSQL) 16."*) ;;
  *) echo "dump-schema.sh: needs pg_dump 16, and $pg_dump is \"$version\". Set PG_DUMP to a version 16 pg_dump." >&2; exit 2 ;;
esac

server=$(psql -X -At -d postgres -c "SELECT current_setting('server_version_num')::int / 10000")
if [ "$server" != 16 ]; then
  echo "dump-schema.sh: needs a PostgreSQL 16 server, as CI uses; the server at $PGHOST:$PGPORT is version $server." >&2; exit 2
fi

prefix="${SQL_TEST_PREFIX:-commune_sqltest}"
if ! [[ "$prefix" =~ ^[a-z_][a-z0-9_]*$ ]] || [ "${#prefix}" -gt 40 ]; then
  echo "dump-schema.sh: SQL_TEST_PREFIX must be lower-case letters, digits or _, at most 40 characters" >&2; exit 2
fi
candidate="${prefix}_schema_$(od -An -N3 -tx1 /dev/urandom | tr -d ' \n')"
if [ -n "$(psql -X -At -d postgres -c "SELECT 1 FROM pg_database WHERE datname = '$candidate'")" ]; then
  echo "dump-schema.sh: a database called $candidate already exists; run again for a new name" >&2; exit 2
fi

work=$(mktemp -d "${TMPDIR:-/tmp}/dump-schema.XXXXXX")
db=""
cleanup() {
  # The name was free when the run began, so a database with it is this run's.
  if [ -n "$db" ]; then
    dropdb --if-exists --force "$db" >/dev/null 2>&1 || echo "dump-schema.sh: could not drop $db" >&2
  fi
  rm -rf "$work"
}
trap cleanup EXIT
trap 'exit 130' INT TERM

db="$candidate"
"$here/tests/run-local.sh" --create "$db" stub >/dev/null

"$pg_dump" --schema-only --no-owner --no-tablespaces \
  --exclude-schema=auth --exclude-schema=neon_auth --dbname="$db" >"$work/raw.sql"

# pg_dump 16.10 and later add \restrict and \unrestrict lines with a new random
# key on every run, and every version names itself and the server. Leaving
# those lines (and the blank line after each) out keeps the file the same for
# the same migrations whichever 16.x wrote it.
{
  cat <<'HEADER'
-- The schema that infra/neon/migrations produce, with every function in full.
-- Written by infra/neon/dump-schema.sh, which rewrites it after a migration is
-- added or changed; CI fails while it is out of date. Do not edit it by hand.
-- It is for reading: databases are built from the migrations, never from this
-- file. Neon's auth and neon_auth schemas are left out.

HEADER
  awk '
    /^\\(un)?restrict [A-Za-z0-9]+$/ { skip_blank = 1; next }
    /^-- Dumped (from database|by pg_dump) version / { skip_blank = 1; next }
    skip_blank && /^$/ { skip_blank = 0; next }
    { skip_blank = 0; print }
  ' "$work/raw.sql"
} >"$work/schema.sql"

if [ "$check" = 1 ]; then
  if [ ! -f "$schema" ]; then
    echo "infra/neon/schema.sql is missing. Run infra/neon/dump-schema.sh and commit the file." >&2
    exit 1
  fi
  if cmp -s "$work/schema.sql" "$schema"; then
    echo "infra/neon/schema.sql matches the migrations"
    exit 0
  fi
  echo "infra/neon/schema.sql is out of date. Run infra/neon/dump-schema.sh and commit the file. The difference starts:" >&2
  diff -u --label "infra/neon/schema.sql (committed)" --label "infra/neon/schema.sql (from the migrations)" \
    "$schema" "$work/schema.sql" | head -n 60 >&2 || true
  exit 1
fi

cp "$work/schema.sql" "$schema"
echo "wrote infra/neon/schema.sql from $(find "$here/migrations" -maxdepth 1 -name '*.sql' | wc -l | tr -d ' ') migrations"
