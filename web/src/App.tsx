import { useEffect, useState } from 'react';
import MemoView from './MemoView';

// ── crawler dashboard types ───────────────────────────────────────────────
interface Run {
  run_uuid: string; mode: string; target_domain: string;
  group_name: string | null; started_at: string; finished_at: string | null;
  pages: number; blocked_pages: number;
}
interface EvidencePage {
  id: number; url: string; final_url: string; http_status: number | null;
  captured_at: string; content_sha256: string; wayback_url: string | null;
  blocked: boolean; block_detail: string | null; ledger_ts: string | null;
}
interface RunDetail {
  run: Run & { crawler_ua: string };
  pages: EvidencePage[];
}

const fmt = (s: string | null) => s ? new Date(s).toLocaleString() : '—';

function RunsList({ onOpen }: { onOpen: (uuid: string) => void }) {
  const [runs, setRuns] = useState<Run[] | null>(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    fetch('/api/runs').then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(setRuns).catch(e => setErr(`Failed to load runs (${e})`));
  }, []);
  if (err) return <div className="card empty">{err}</div>;
  if (!runs) return <div className="card empty">Loading runs…</div>;
  if (!runs.length) return <div className="card empty">
    No crawl runs yet. Trigger one from the GitHub Actions tab.</div>;
  return (
    <div className="card">
      <table>
        <thead><tr>
          <th>Target</th><th>Mode</th><th>Group</th><th>Started</th>
          <th>Pages</th><th>Blocked</th>
        </tr></thead>
        <tbody>
          {runs.map(r => (
            <tr key={r.run_uuid} className="clickable" onClick={() => onOpen(r.run_uuid)}>
              <td><strong>{r.target_domain}</strong></td>
              <td><span className="badge mode">{r.mode}</span></td>
              <td>{r.group_name ?? '—'}</td>
              <td>{fmt(r.started_at)}</td>
              <td>{r.pages}</td>
              <td>{r.blocked_pages > 0
                ? <span className="badge blocked">{r.blocked_pages} blocked</span>
                : <span className="badge ok">0</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RunView({ uuid, onBack }: { uuid: string; onBack: () => void }) {
  const [detail, setDetail] = useState<RunDetail | null>(null);
  useEffect(() => {
    fetch(`/api/run-detail?uuid=${uuid}`).then(r => r.json()).then(setDetail);
  }, [uuid]);
  if (!detail) return <div className="card empty">Loading evidence…</div>;
  const { run, pages } = detail;
  return (
    <>
      <button className="back" onClick={onBack}>← All runs</button>
      <div className="card">
        <h2 style={{ margin: 0 }}>{run.target_domain}</h2>
        <p className="meta">
          Run {run.run_uuid} · {run.mode}
          {run.group_name ? ` · group: ${run.group_name}` : ''}<br />
          {fmt(run.started_at)} → {fmt(run.finished_at)} · UA: {run.crawler_ua}
        </p>
      </div>
      <div className="card">
        <table>
          <thead><tr>
            <th>Captured URL</th><th>Status</th><th>SHA-256</th>
            <th>Ledger</th><th>Wayback</th>
          </tr></thead>
          <tbody>
            {pages.map(p => (
              <tr key={p.id}>
                <td>
                  {p.final_url}
                  {p.blocked && <div><span className="badge blocked">
                    FINDING: {p.block_detail}</span></div>}
                </td>
                <td>{p.http_status ?? '—'}</td>
                <td className="hash" title={p.content_sha256}>
                  {p.content_sha256.slice(0, 16)}…</td>
                <td>{p.ledger_ts
                  ? <span className="badge ok">ledgered</span>
                  : <span className="badge blocked">missing</span>}</td>
                <td>{p.wayback_url
                  ? <a href={p.wayback_url} target="_blank" rel="noreferrer">archive</a>
                  : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ── app root ──────────────────────────────────────────────────────────────

export default function App() {
  const [open, setOpen] = useState<string | null>(null);
  const isMemo = window.location.pathname === '/memo';

  return (
    <>
      <header>
        <h1>Audit Crawler</h1>
        <span className="sub">
          {isMemo
            ? 'Perhaps* 24-Point Source Integrity Check'
            : 'evidence & chain-of-custody dashboard'}
        </span>
        {isMemo && <a href="/" className="header-nav-link">← Dashboard</a>}
      </header>
      <main>
        {isMemo
          ? <MemoView />
          : open
            ? <RunView uuid={open} onBack={() => setOpen(null)} />
            : <RunsList onOpen={setOpen} />}
      </main>
    </>
  );
}
