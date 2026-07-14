CREATE SCHEMA IF NOT EXISTS audit;

CREATE TABLE IF NOT EXISTS audit.crawl_run (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  run_uuid      UUID NOT NULL DEFAULT gen_random_uuid(),
  mode          TEXT NOT NULL CHECK (mode IN ('whatif','single','group')),
  target_domain TEXT NOT NULL,
  group_name    TEXT,
  started_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at   TIMESTAMPTZ,
  crawler_ua    TEXT NOT NULL,
  notes         TEXT
);

CREATE TABLE IF NOT EXISTS audit.evidence_page (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  run_id          BIGINT NOT NULL REFERENCES audit.crawl_run(id),
  url             TEXT NOT NULL,
  final_url       TEXT NOT NULL,
  http_status     INT,
  captured_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  content_sha256  TEXT NOT NULL,
  html_path       TEXT NOT NULL,
  screenshot_path TEXT,
  pdf_path        TEXT,
  headers_json    JSONB NOT NULL,
  priority_score  INT NOT NULL,
  wayback_url     TEXT,
  blocked         BOOLEAN NOT NULL DEFAULT FALSE,
  block_detail    TEXT
);

CREATE INDEX IF NOT EXISTS idx_evidence_page_run    ON audit.evidence_page(run_id);
CREATE INDEX IF NOT EXISTS idx_evidence_page_domain ON audit.evidence_page(final_url);
CREATE INDEX IF NOT EXISTS idx_evidence_page_hash   ON audit.evidence_page(content_sha256);

CREATE TABLE IF NOT EXISTS audit.structural_artifact (
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  run_id       BIGINT NOT NULL REFERENCES audit.crawl_run(id),
  artifact     TEXT NOT NULL CHECK (artifact IN (
                 'security_txt','trust_portal_link','soc2_badge_resolves',
                 'soc2_badge_static_only','subprocessor_list','dpa_link',
                 'ai_policy_page','model_card','verification_process_page')),
  present      BOOLEAN NOT NULL,
  source_url   TEXT,
  detail       TEXT,
  evidence_id  BIGINT REFERENCES audit.evidence_page(id),
  recorded_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit.hash_ledger (
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  evidence_id  BIGINT NOT NULL REFERENCES audit.evidence_page(id),
  sha256       TEXT NOT NULL,
  algo         TEXT NOT NULL DEFAULT 'sha256',
  ledger_ts    TIMESTAMPTZ NOT NULL DEFAULT now()
);

REVOKE UPDATE, DELETE ON audit.evidence_page, audit.hash_ledger,
  audit.structural_artifact FROM PUBLIC;
