#!/usr/bin/env bash
# Runs the database tests in this folder against a local PostgreSQL server:
# every *.sql test on its own fresh database, then every *.mjs test
# (task_lock_order.mjs) the same way. CI runs it, and so can you before
# pushing a migration:
#
#   PGHOST=127.0.0.1 PGPORT=5432 PGUSER=commune PGPASSWORD=commune \
#     infra/neon/tests/run-local.sh [test-name ...]
#
# With names (grants, task_lock_order, ...) it runs only those tests. The
# *.mjs tests need the local API's dependencies installed (they use its pg).
#
# The connection comes from the usual PG* variables. PGHOST defaults to
# 127.0.0.1 and must be a loopback address: the auth stand-ins below create
# the authenticated and anonymous roles, which must never reach Neon. The role
# needs to create databases and roles (a local superuser, as in CI).
#
# Each test runs on a copy of one of two databases built from the migrations,
# one per local auth mode:
#   local  infra/local/bootstrap.sql, every migration, infra/local/after-core.sql
#          (what the local API runs on)
#   stub   infra/neon/tests/local_auth_stub.sql and every migration
# A test's leading comment decides: one naming the stub runs on stub, one
# naming bootstrap.sql or after-core.sql runs on local, and any other runs on
# stub. One written for a "Neon branch" is skipped, as it needs hosted auth.
#
# It only ever drops databases it created in the same run. Their names start
# with SQL_TEST_PREFIX (default commune_sqltest) and a random run id that no
# database had when the run began, so an interrupted run cleans up after
# itself and never touches anything else.
#
#   infra/neon/tests/run-local.sh --create <name> <local|stub>
# builds one new database the same way and leaves it for the caller (the
# local API and reminder worker tests use this). It refuses a name in use.
set -euo pipefail
export LC_ALL=C

here=$(cd "$(dirname "$0")" && pwd)
root=$(cd "$here/../../.." && pwd)
export PGHOST="${PGHOST:-127.0.0.1}" PGPORT="${PGPORT:-5432}"
case "$PGHOST" in
  127.0.0.1|localhost) ;;
  *) echo "run-local.sh: PGHOST must be 127.0.0.1 or localhost, not $PGHOST" >&2; exit 2 ;;
esac

valid_name() {
  [[ "$1" =~ ^[a-z_][a-z0-9_]*$ ]] && [ "${#1}" -le 63 ]
}
# Names of the databases carrying this run's id (validated, so safe to quote).
run_databases() {
  psql -X -At -d postgres -c "SELECT datname FROM pg_database WHERE starts_with(datname, '${1}_') ORDER BY 1"
}

work=$(mktemp -d "${TMPDIR:-/tmp}/run-local.XXXXXX")
run=""
cleanup() {
  local db
  if [ -n "$run" ]; then
    for db in $(run_databases "$run" 2>/dev/null); do
      dropdb --if-exists --force "$db" >/dev/null 2>&1 || echo "run-local.sh: could not drop $db" >&2
    done
  fi
  rm -rf "$work"
}
trap cleanup EXIT
trap 'exit 130' INT TERM

# Applies every file for one auth mode to a new, empty database.
migrate() {
  local db="$1" mode="$2" file
  local files=()
  if [ "$mode" = local ]; then files+=("$root/infra/local/bootstrap.sql"); else files+=("$here/local_auth_stub.sql"); fi
  files+=("$root"/infra/neon/migrations/*.sql)
  if [ "$mode" = local ]; then files+=("$root/infra/local/after-core.sql"); fi
  for file in "${files[@]}"; do
    if ! psql -X -q -v ON_ERROR_STOP=1 -d "$db" -f "$file" >"$work/build.log" 2>&1; then
      echo "FAILED building the $mode database at ${file#"$root"/}:" >&2
      tail -n 20 "$work/build.log" | sed 's/^/    /' >&2
      return 1
    fi
  done
}

# local, stub or neon, from the test's leading comment lines.
mode_of() {
  local header
  header=$(sed -n -E -e '/^(--|\/\/)/!q' -e p "$1")
  case "$header" in
    *"Neon branch"*) echo neon ;;
    *local_auth_stub*|*"auth stub"*|*"local stub"*) echo stub ;;
    *bootstrap.sql*|*after-core*) echo local ;;
    *) echo stub ;;
  esac
}

if [ "${1:-}" = "--create" ]; then
  if [ "$#" -ne 3 ] || ! valid_name "$2" || { [ "$3" != local ] && [ "$3" != stub ]; }; then
    echo "usage: run-local.sh --create <database-name> <local|stub>" >&2; exit 2
  fi
  createdb "$2"  # fails if the name is taken
  if ! migrate "$2" "$3"; then dropdb --force "$2"; exit 1; fi
  echo "created $2 ($3)"
  exit 0
fi

prefix="${SQL_TEST_PREFIX:-commune_sqltest}"
if ! valid_name "$prefix" || [ "${#prefix}" -gt 40 ]; then
  echo "run-local.sh: SQL_TEST_PREFIX must be lower-case letters, digits or _, at most 40 characters" >&2; exit 2
fi

tests=()
if [ "$#" -gt 0 ]; then
  for name in "$@"; do
    if [ -f "$here/$name.sql" ] && [ "$name" != local_auth_stub ]; then tests+=("$here/$name.sql")
    elif [ -f "$here/$name.mjs" ]; then tests+=("$here/$name.mjs")
    else echo "run-local.sh: no test called $name in ${here#"$root"/}" >&2; exit 2; fi
  done
else
  for test in "$here"/*.sql "$here"/*.mjs; do
    [ "$(basename "$test")" = local_auth_stub.sql ] || tests+=("$test")
  done
fi

candidate="${prefix}_$(od -An -N3 -tx1 /dev/urandom | tr -d ' \n')"
if [ -n "$(run_databases "$candidate")" ]; then
  echo "run-local.sh: databases named ${candidate}_* already exist; run again for a new id" >&2; exit 2
fi
run="$candidate"

migrations=("$root"/infra/neon/migrations/*.sql)
echo "Building the local and stub databases from ${#migrations[@]} migrations"
# Local first: on a fresh server the local database then sees only the roles
# bootstrap.sql makes, as the local API does.
for mode in local stub; do
  createdb "${run}_$mode"
  migrate "${run}_$mode" "$mode"
done

pass=0; fail=0; skip=0; n=0
for test in "${tests[@]}"; do
  name=$(basename "$test"); name="${name%.*}"
  mode=$(mode_of "$test")
  if [ "$mode" = neon ]; then
    echo "SKIP $name (needs a Neon branch)"; skip=$((skip + 1)); continue
  fi
  n=$((n + 1)); db="${run}_$n"
  createdb -T "${run}_$mode" "$db"
  if [ "${test##*.}" = sql ]; then
    # A hung lock wait fails the test instead of the whole run.
    PGOPTIONS="${PGOPTIONS:-} -c statement_timeout=120s" \
      psql -X -q -v ON_ERROR_STOP=1 -d "$db" -f "$test" >"$work/test.log" 2>&1 && ok=1 || ok=0
  else
    # pg takes the user and password from the PG* variables.
    DATABASE_URL="postgres://127.0.0.1:$PGPORT/$db" node "$test" >"$work/test.log" 2>&1 && ok=1 || ok=0
  fi
  if [ "$ok" = 1 ]; then
    echo "PASS $name ($mode)"; pass=$((pass + 1))
  else
    echo "FAIL $name ($mode)"; tail -n 20 "$work/test.log" | sed 's/^/    /'; fail=$((fail + 1))
  fi
  dropdb --if-exists --force "$db" >/dev/null 2>&1 || true
done

echo "Database tests: $pass passed, $fail failed, $skip skipped"
[ "$fail" -eq 0 ]
