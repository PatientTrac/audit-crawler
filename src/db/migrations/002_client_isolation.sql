-- AUTH-1: Client isolation — tenancy, ownership, row-level security
-- Apply via: psql $DATABASE_URL -f src/db/migrations/002_client_isolation.sql
-- Verify via: src/db/verify/verify-rls.sql
-- NEVER leave audit.crawl_run/evidence_page/hash_ledger nullable-and-hoped.

-- ─────────────────────────────────────────────────────────────────────────
-- 1. TENANCY TABLES
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS audit.client (
  id          UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name        TEXT        NOT NULL,
  approved    BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit.client_user (
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id  UUID NOT NULL REFERENCES audit.client(id) ON DELETE CASCADE,
  role       TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('member','admin')),
  approved   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, client_id)
);

-- ─────────────────────────────────────────────────────────────────────────
-- 2. OWNERSHIP ON EVIDENCE
-- ─────────────────────────────────────────────────────────────────────────

-- Internal owner client — all existing crawl runs belong to this client.
INSERT INTO audit.client (name, approved)
VALUES ('AegisIQ Internal', TRUE)
ON CONFLICT DO NOTHING;

-- Add client_id to crawl_run (nullable first for safe backfill)
ALTER TABLE audit.crawl_run
  ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES audit.client(id);

-- Backfill all existing runs to the internal client
UPDATE audit.crawl_run
SET client_id = (SELECT id FROM audit.client WHERE name = 'AegisIQ Internal')
WHERE client_id IS NULL;

-- Now enforce NOT NULL — all rows have been backfilled
ALTER TABLE audit.crawl_run
  ALTER COLUMN client_id SET NOT NULL;

-- evidence_page and hash_ledger inherit ownership via run_id FK to crawl_run.
-- client_id is NOT denormalized onto them — single source of truth is crawl_run.

-- ─────────────────────────────────────────────────────────────────────────
-- 3. SECURITY-DEFINER HELPERS
-- ─────────────────────────────────────────────────────────────────────────

-- Returns TRUE iff the current auth.uid() has an approved client_user row
-- for the given client. Used in RLS policies.
CREATE OR REPLACE FUNCTION audit.is_approved_member(target_client UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = audit, public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM audit.client_user
    WHERE user_id   = auth.uid()
      AND client_id = target_client
      AND approved  = TRUE
  );
$$;

-- Returns TRUE iff the current auth.uid() has an approved admin row on the
-- internal (AegisIQ) client. That is the platform-admin designation.
CREATE OR REPLACE FUNCTION audit.is_platform_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = audit, public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM audit.client_user cu
    JOIN   audit.client c ON c.id = cu.client_id
    WHERE  cu.user_id  = auth.uid()
      AND  cu.role     = 'admin'
      AND  cu.approved = TRUE
      AND  c.name      = 'AegisIQ Internal'
  );
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- 4. ENABLE RLS + POLICIES
-- ─────────────────────────────────────────────────────────────────────────

-- audit.client
ALTER TABLE audit.client ENABLE ROW LEVEL SECURITY;

CREATE POLICY client_select_admin ON audit.client
  FOR SELECT USING (audit.is_platform_admin());

-- audit.client_user
ALTER TABLE audit.client_user ENABLE ROW LEVEL SECURITY;

CREATE POLICY client_user_select ON audit.client_user
  FOR SELECT USING (
    user_id = auth.uid()          -- a user sees their own row
    OR audit.is_platform_admin()  -- platform admin sees all
  );

-- audit.crawl_run
ALTER TABLE audit.crawl_run ENABLE ROW LEVEL SECURITY;

CREATE POLICY crawl_run_select ON audit.crawl_run
  FOR SELECT USING (
    audit.is_platform_admin()
    OR audit.is_approved_member(client_id)
  );

-- audit.evidence_page
-- Visible iff the parent run is visible (join through crawl_run).
ALTER TABLE audit.evidence_page ENABLE ROW LEVEL SECURITY;

CREATE POLICY evidence_page_select ON audit.evidence_page
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM audit.crawl_run r
      WHERE r.id = evidence_page.run_id
        AND (audit.is_platform_admin() OR audit.is_approved_member(r.client_id))
    )
  );

-- audit.hash_ledger
-- Visible iff the parent evidence_page → run is visible.
ALTER TABLE audit.hash_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY hash_ledger_select ON audit.hash_ledger
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM audit.evidence_page e
      JOIN   audit.crawl_run r ON r.id = e.run_id
      WHERE  e.id = hash_ledger.evidence_id
        AND  (audit.is_platform_admin() OR audit.is_approved_member(r.client_id))
    )
  );

-- NO client-facing INSERT/UPDATE/DELETE policies on any audit.* table.
-- Clients are read-only. Crawler writes via service role (bypasses RLS).
-- Approval writes are admin-only (AUTH-3).

-- Unapproved or unlinked authenticated users satisfy no SELECT policy
-- and receive zero rows. authenticated ≠ authorized by design.
