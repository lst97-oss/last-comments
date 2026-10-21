#!/bin/sh
# First-init hook: create the business role and database.
set -eu

psql -v ON_ERROR_STOP=1 \
  --username "$POSTGRES_USER" \
  --dbname "$POSTGRES_DB" \
  --set=business_password="$BUSINESS_DB_PASSWORD" <<'SQL'
SELECT format('CREATE ROLE business LOGIN PASSWORD %L', :'business_password')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'business')\gexec
SELECT 'CREATE DATABASE business_comments OWNER business'
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = 'business_comments')\gexec
SQL
