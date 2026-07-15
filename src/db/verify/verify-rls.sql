-- AUTH-1 RLS Verification
-- Seeds two clients, three users; asserts the four isolation guarantees.
-- Run as: psql $DATABASE_URL -f src/db/verify/verify-rls.sql
-- Requires: SET LOCAL ROLE authenticated before the DO block (done inline below)
-- All assertions must report 'PASS'. Any 'FAIL' means RLS is not correctly isolating.

BEGIN;

-- ── seed ───────────────────────────────────────────────────────────────────

-- Clients
INSERT INTO audit.client (id, name, approved) VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Client A', TRUE),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'Client B', TRUE);

-- Fake auth.users rows (adjust if your test setup differs)
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0001-000000000001', 'ua@test.invalid'),
  ('00000000-0000-0000-0001-000000000002', 'ub@test.invalid'),
  ('00000000-0000-0000-0001-000000000003', 'up@test.invalid')
ON CONFLICT DO NOTHING;

-- client_user links: uA→A (approved), uB→B (approved), uP pending (no approved link)
INSERT INTO audit.client_user (user_id, client_id, role, approved) VALUES
  ('00000000-0000-0000-0001-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'member', TRUE),
  ('00000000-0000-0000-0001-000000000002', 'bbbbbbbb-0000-0000-0000-000000000002', 'member', TRUE),
  ('00000000-0000-0000-0001-000000000003', 'aaaaaaaa-0000-0000-0000-000000000001', 'member', FALSE);

-- Crawl runs (OVERRIDING SYSTEM VALUE required: id is GENERATED ALWAYS AS IDENTITY)
INSERT INTO audit.crawl_run (id, run_uuid, mode, target_domain, crawler_ua, client_id)
OVERRIDING SYSTEM VALUE VALUES
  (9001, gen_random_uuid(), 'single', 'client-a.example.com', 'test-ua', 'aaaaaaaa-0000-0000-0000-000000000001'),
  (9002, gen_random_uuid(), 'single', 'client-b.example.com', 'test-ua', 'bbbbbbbb-0000-0000-0000-000000000002');

-- Evidence pages (OVERRIDING SYSTEM VALUE required: id is GENERATED ALWAYS AS IDENTITY)
INSERT INTO audit.evidence_page (id, run_id, url, final_url, content_sha256, html_path, headers_json, priority_score)
OVERRIDING SYSTEM VALUE VALUES
  (9001, 9001, 'https://client-a.example.com', 'https://client-a.example.com', repeat('a',64), '/tmp/a.html', '{}', 0),
  (9002, 9002, 'https://client-b.example.com', 'https://client-b.example.com', repeat('b',64), '/tmp/b.html', '{}', 0);

-- Hash ledger
INSERT INTO audit.hash_ledger (evidence_id, sha256) VALUES
  (9001, repeat('a',64)),
  (9002, repeat('b',64));

-- Switch to authenticated role so RLS policies are enforced.
-- Seed above ran as postgres (bypasses RLS); assertions must run as authenticated.
SET LOCAL ROLE authenticated;

-- ── assertions ─────────────────────────────────────────────────────────────
-- Each block sets request.jwt.claims to impersonate a user, then asserts
-- row visibility via the RLS policies (active because role = authenticated).

DO $$
DECLARE
  cnt INT;
BEGIN

  -- ── uA: approved member of Client A ──────────────────────────────────────
  PERFORM set_config('request.jwt.claims',
    '{"sub":"00000000-0000-0000-0001-000000000001"}', TRUE);

  -- uA sees run A
  SELECT count(*) INTO cnt FROM audit.crawl_run WHERE id = 9001;
  ASSERT cnt = 1,
    'FAIL: uA should see run A (got ' || cnt || ')';
  RAISE NOTICE 'PASS: uA sees run A';

  -- uA does NOT see run B
  SELECT count(*) INTO cnt FROM audit.crawl_run WHERE id = 9002;
  ASSERT cnt = 0,
    'FAIL: uA should NOT see run B (got ' || cnt || ')';
  RAISE NOTICE 'PASS: uA cannot see run B (cross-client block)';

  -- uA sees A evidence, not B evidence
  SELECT count(*) INTO cnt FROM audit.evidence_page WHERE id = 9001;
  ASSERT cnt = 1, 'FAIL: uA should see evidence A';
  SELECT count(*) INTO cnt FROM audit.evidence_page WHERE id = 9002;
  ASSERT cnt = 0, 'FAIL: uA should NOT see evidence B';
  RAISE NOTICE 'PASS: uA evidence isolation correct';

  -- uA sees A hash, not B hash
  SELECT count(*) INTO cnt FROM audit.hash_ledger WHERE evidence_id = 9001;
  ASSERT cnt = 1, 'FAIL: uA should see hash A';
  SELECT count(*) INTO cnt FROM audit.hash_ledger WHERE evidence_id = 9002;
  ASSERT cnt = 0, 'FAIL: uA should NOT see hash B';
  RAISE NOTICE 'PASS: uA hash isolation correct';

  -- ── uB: approved member of Client B ──────────────────────────────────────
  PERFORM set_config('request.jwt.claims',
    '{"sub":"00000000-0000-0000-0001-000000000002"}', TRUE);

  SELECT count(*) INTO cnt FROM audit.crawl_run WHERE id = 9002;
  ASSERT cnt = 1, 'FAIL: uB should see run B';
  RAISE NOTICE 'PASS: uB sees run B';

  SELECT count(*) INTO cnt FROM audit.crawl_run WHERE id = 9001;
  ASSERT cnt = 0, 'FAIL: uB should NOT see run A';
  RAISE NOTICE 'PASS: uB cannot see run A';

  -- ── uP: authenticated but pending (no approved link) ─────────────────────
  PERFORM set_config('request.jwt.claims',
    '{"sub":"00000000-0000-0000-0001-000000000003"}', TRUE);

  SELECT count(*) INTO cnt FROM audit.crawl_run;
  ASSERT cnt = 0, 'FAIL: uP should see NOTHING from crawl_run (got ' || cnt || ')';
  RAISE NOTICE 'PASS: uP sees zero crawl_run rows';

  SELECT count(*) INTO cnt FROM audit.evidence_page;
  ASSERT cnt = 0, 'FAIL: uP should see NOTHING from evidence_page';
  RAISE NOTICE 'PASS: uP sees zero evidence_page rows';

  SELECT count(*) INTO cnt FROM audit.hash_ledger;
  ASSERT cnt = 0, 'FAIL: uP should see NOTHING from hash_ledger';
  RAISE NOTICE 'PASS: uP sees zero hash_ledger rows';

END;
$$;

ROLLBACK; -- All seed data is transient; does not persist.
