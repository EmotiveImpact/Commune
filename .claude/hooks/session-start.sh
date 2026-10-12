#!/bin/bash
# Prepares a Claude Code cloud session: installs the web app, local API and
# reminder worker dependencies, starts the container's PostgreSQL and creates a
# disposable `commune_dev` database with every migration applied.
# Cloud sessions only; it does nothing on a local machine.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR"

pnpm install --frozen-lockfile --prefer-offline \
  --filter workspace \
  --filter @commune/web \
  --filter @commune/local-api \
  --filter @commune/reminder-worker

# PostgreSQL is optional: skip the database step if the image has none.
if ! command -v pg_ctlcluster >/dev/null 2>&1; then
  echo "PostgreSQL not installed; skipping database setup." >&2
  exit 0
fi

cluster=$(pg_lsclusters --no-header | awk 'NR==1 {print $1" "$2}')
if [ -n "$cluster" ]; then
  # shellcheck disable=SC2086
  pg_ctlcluster $cluster start 2>/dev/null || true
fi
for _ in $(seq 1 20); do
  pg_isready -q -h 127.0.0.1 && break
  sleep 0.5
done

# A local superuser for disposable test databases. The password is not a
# secret: this cluster only listens on loopback inside the cloud container.
su postgres -c "psql -q -v ON_ERROR_STOP=1" <<'SQL'
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'commune') THEN
    CREATE ROLE commune SUPERUSER LOGIN PASSWORD 'commune';
  END IF;
END
$$;
SQL

export PGHOST=127.0.0.1 PGPORT=5432 PGUSER=commune PGPASSWORD=commune
if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
  {
    echo "export PGHOST=127.0.0.1 PGPORT=5432 PGUSER=commune PGPASSWORD=commune"
    echo "export COMMUNE_DEV_DATABASE_URL=postgres://commune:commune@127.0.0.1:5432/commune_dev"
  } >> "$CLAUDE_ENV_FILE"
fi

# Build commune_dev once, as described in infra/local/README.md. An existing
# database is left untouched; drop it to rebuild from the migrations.
if ! psql -d postgres -Atc "SELECT 1 FROM pg_database WHERE datname = 'commune_dev'" | grep -q 1; then
  createdb commune_dev
  for file in infra/local/bootstrap.sql $(ls infra/neon/migrations/*.sql | sort) infra/local/after-core.sql; do
    psql -d commune_dev -q -v ON_ERROR_STOP=1 -f "$file" >/dev/null
  done
fi
