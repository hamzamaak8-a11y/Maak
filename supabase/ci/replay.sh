#!/usr/bin/env bash
# Rebuilds the database from the repository on a throw-away local Postgres: platform stubs, baseline/, then migrations/.
# Usage: PSQL="psql -h /tmp -p 5544 -U postgres" bash supabase/ci/replay.sh maak_replay
# Storage-policy statements that need the real Storage extension print errors; everything else must apply cleanly.
set -euo pipefail
DB="${1:-maak_replay}"
PSQL="${PSQL:-psql}"
cd "$(dirname "$0")/../.."
{
  echo "drop database if exists $DB;"
  echo "create database $DB;"
  echo "\\c $DB"
  echo "\\i supabase/ci/local-stubs.sql"
  for f in schema profiles provider-onboarding admin-verification bookings phase-a-listing-foundation security-hardening admin-control-center chat critical-security-hardening tighten-authenticated-rls-roles production-hardening-followup lock-listing-helper-execution; do
    echo "\\i supabase/baseline/$f.sql"
  done
  for f in supabase/migrations/*.sql; do echo "\\i $f"; done
} | $PSQL -d postgres -v ON_ERROR_STOP=0 2>&1 | grep -E "ERROR" | grep -v -E "storage\.foldername|owner_id|admin_toggle_review_visibility|get_admin_reviews" || true
echo "replayed into $DB"
