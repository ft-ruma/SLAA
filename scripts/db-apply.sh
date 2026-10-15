#!/usr/bin/env bash
# Apply schema + additions + seed to the database in $1 (a connection URL).
# Usage: scripts/db-apply.sh postgres://localhost/slaa_dev
set -euo pipefail
DB_URL="${1:?database URL required}"
DIR="$(cd "$(dirname "$0")/../db" && pwd)"
for f in 001_schema.sql 002_app_additions.sql 003_admin_delete.sql 004_athlete_details.sql 005_remove_birth_cert_add_filters.sql 006_coach_phone_optional.sql seed_reference.sql; do
  echo "applying $f"
  psql "$DB_URL" -v ON_ERROR_STOP=1 -q -f "$DIR/$f"
done
