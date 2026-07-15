-- AUTH-1 (fix): Grant schema + table access to Supabase roles
-- RLS policies were in place but authenticated role could not reach the schema.
-- Apply via: psql $DATABASE_URL -f src/db/migrations/003_grant_audit_access.sql
-- Follows 002_client_isolation.sql

-- ── Schema access ────────────────────────────────────────────────────────────
-- authenticated: JWT-verified users (PostgREST API callers)
-- service_role:  crawler + admin writes (bypasses RLS via BYPASSRLS attribute)
GRANT USAGE ON SCHEMA audit TO authenticated, service_role;

-- ── Read access for authenticated users (RLS enforces row-level restrictions) ─
-- Clients see only their own client row (platform admin only), their own
-- client_user row, and crawl_run/evidence_page/hash_ledger filtered by RLS.
GRANT SELECT ON audit.client             TO authenticated;
GRANT SELECT ON audit.client_user        TO authenticated;
GRANT SELECT ON audit.crawl_run          TO authenticated;
GRANT SELECT ON audit.evidence_page      TO authenticated;
GRANT SELECT ON audit.hash_ledger        TO authenticated;
GRANT SELECT ON audit.structural_artifact TO authenticated;

-- ── Write access for service_role (crawler pipeline) ────────────────────────
-- Crawler writes via service_role which has BYPASSRLS; explicit grants for
-- clarity and in case BYPASSRLS alone is insufficient in some client contexts.
GRANT ALL ON audit.crawl_run            TO service_role;
GRANT ALL ON audit.evidence_page        TO service_role;
GRANT ALL ON audit.hash_ledger          TO service_role;
GRANT ALL ON audit.structural_artifact  TO service_role;
GRANT ALL ON audit.client               TO service_role;
GRANT ALL ON audit.client_user          TO service_role;

-- Identity sequences: service_role needs usage for GENERATED ALWAYS columns
GRANT USAGE ON ALL SEQUENCES IN SCHEMA audit TO service_role;

-- ── Helper function access ───────────────────────────────────────────────────
-- SECURITY DEFINER functions already execute as owner, but callers still need
-- EXECUTE privilege for PostgREST to invoke them.
GRANT EXECUTE ON FUNCTION audit.is_approved_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION audit.is_platform_admin()      TO authenticated;

-- anon role intentionally NOT granted: unauthenticated callers must not reach
-- audit schema at all. Permission denied at schema level is the desired result.
