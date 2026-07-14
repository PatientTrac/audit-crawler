import pg from 'pg';
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

// TODO: JWT-gate before sharing beyond yourself. Target lists reveal
// who is being audited, which is client-confidential.
export default async () => {
  const { rows } = await pool.query(
    `SELECT r.run_uuid, r.mode, r.target_domain, r.group_name,
            r.started_at, r.finished_at,
            count(e.id)::int AS pages,
            count(e.id) FILTER (WHERE e.blocked)::int AS blocked_pages
       FROM audit.crawl_run r
       LEFT JOIN audit.evidence_page e ON e.run_id = r.id
      GROUP BY r.id ORDER BY r.started_at DESC LIMIT 50`);
  return Response.json(rows);
};
