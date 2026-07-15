import { randomUUID } from 'node:crypto';
import { crawlDomain } from '../crawler/crawl.js';
import { requestWaybackSnapshot } from '../capture/wayback.js';
import { db } from '../db/client.js';
import { CONFIG } from '../config.js';

export async function runSingle(domain: string, groupName?: string, clientId?: string) {
  const resolvedClientId = clientId || CONFIG.clientId;
  if (!resolvedClientId) {
    throw new Error('client_id is required: pass --client-id <uuid> or set CLIENT_ID env var');
  }

  const { rows: existing } = await db.query(
    'SELECT id FROM audit.client WHERE id = $1', [resolvedClientId]);
  if (existing.length === 0) {
    throw new Error(`client_id '${resolvedClientId}' not found in audit.client`);
  }

  const runUuid = randomUUID();
  const runDir = `${CONFIG.evidenceDir}/${domain}/${runUuid}`;

  const { rows: [run] } = await db.query(
    `INSERT INTO audit.crawl_run (run_uuid, mode, target_domain, group_name, crawler_ua, client_id)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [runUuid, groupName ? 'group' : 'single', domain, groupName ?? null, CONFIG.userAgent, resolvedClientId]);

  const { captures } = await crawlDomain(domain, { dryRun: false, runDir });

  for (const c of captures) {
    const wayback = c.blocked ? null : await requestWaybackSnapshot(c.finalUrl);
    const { rows: [ev] } = await db.query(
      `INSERT INTO audit.evidence_page
         (run_id, url, final_url, http_status, content_sha256, html_path,
          screenshot_path, pdf_path, headers_json, priority_score,
          wayback_url, blocked, block_detail)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id`,
      [run.id, c.url, c.finalUrl, c.status, c.sha256, c.htmlPath,
       c.screenshotPath, c.pdfPath, JSON.stringify(c.headers), 0,
       wayback, c.blocked, c.blockDetail]);
    await db.query(
      `INSERT INTO audit.hash_ledger (evidence_id, sha256) VALUES ($1, $2)`,
      [ev.id, c.sha256]);
  }

  await db.query(`UPDATE audit.crawl_run SET finished_at = now() WHERE id = $1`, [run.id]);
  console.log(`Run ${runUuid}: ${captures.length} pages captured, ` +
    `${captures.filter(c => c.blocked).length} blocked (recorded as findings).`);
}
