import pg from 'pg';
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

export default async (req: Request) => {
  const uuid = new URL(req.url).searchParams.get('uuid');
  if (!uuid || !/^[0-9a-f-]{36}$/i.test(uuid))
    return new Response('bad uuid', { status: 400 });

  const { rows: [run] } = await pool.query(
    `SELECT id, run_uuid, mode, target_domain, group_name, started_at,
            finished_at, crawler_ua
       FROM audit.crawl_run WHERE run_uuid = $1`, [uuid]);
  if (!run) return new Response('not found', { status: 404 });

  const { rows: pages } = await pool.query(
    `SELECT e.id, e.url, e.final_url, e.http_status, e.captured_at,
            e.content_sha256, e.wayback_url, e.blocked, e.block_detail,
            l.ledger_ts
       FROM audit.evidence_page e
       LEFT JOIN audit.hash_ledger l ON l.evidence_id = e.id
      WHERE e.run_id = $1 ORDER BY e.captured_at`, [run.id]);

  return Response.json({ run, pages });
};
