export const CONFIG = {
  userAgent:
    'AuditCrawler/0.1 (+compliance-surface-audit; contact: audits@yourdomain.com)',
  maxDepth: 3,
  maxPagesPerDomain: 60,
  navTimeoutMs: 30_000,
  politeDelayMs: 1_500,
  evidenceDir: process.env.EVIDENCE_DIR ?? './evidence',
  databaseUrl: process.env.DATABASE_URL ?? '',
  clientId: process.env.CLIENT_ID ?? '',
};
