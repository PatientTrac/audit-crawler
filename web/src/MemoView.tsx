import { useState } from 'react';
import { Memo } from './schema/memo';
import { MemoValidationError, SCHEMA_VERSION } from './schema/validate';
import type { MemoInput } from './schema/memo.types';

// Static fixture imports — Vite bundles these; server.fs.allow covers dev server.
// Add new ratified fixtures here as they arrive from Colab.
import exampleMemo from '../../fixtures/valid/example-memo.json';
import custodyPredTrue from '../../fixtures/valid/custody-predicate-true.json';
import cleanReport from '../../fixtures/valid/clean-report.json';

type Section   = MemoInput['sections'][number];
type ExecIssue = MemoInput['exec_issues'][number];
type Finding   = Section['findings'][number];

const FIXTURES: Record<string, unknown> = {
  'example-memo':          exampleMemo,
  'custody-predicate-true': custodyPredTrue,
  'clean-report':          cleanReport,
};

// ── helpers ────────────────────────────────────────────────────────────────

/** §6 disposition: render as link if string parses as URL (with or without scheme). */
function tryHref(s: string | null): string | null {
  if (!s) return null;
  try { new URL(s); return s; } catch {}
  try { new URL('https://' + s); return 'https://' + s; } catch {}
  return null;
}

/**
 * Derive section id from check_codes string (e.g. "A1, A4" → "A").
 * SCHEMA-CHANGE REQUEST: exec_issues carry no typed section_id field.
 * This heuristic (first letter of first code) is used only for stub tab links.
 * If check_codes format changes this will silently degrade to no link.
 */
function sectionFromCodes(codes: string): string | null {
  const m = codes.trim().match(/^([A-F])/i);
  return m ? m[1].toUpperCase() : null;
}

// ── verdict badges ─────────────────────────────────────────────────────────

const VERDICT_STYLE: Record<string, [string, string]> = {
  PASS:  ['#e8f6f0', '#1e7f5c'],
  FLAG:  ['#fef9ec', '#b7791f'],
  FAIL:  ['#fdecea', '#c0392b'],
  'N/A': ['#f0f2f5', '#6b7a8c'],
};

const OVERALL_STYLE: Record<Section['overall_verdict'], [string, string]> = {
  pass:  ['#e8f6f0', '#1e7f5c'],
  flag:  ['#fef9ec', '#b7791f'],
  fail:  ['#fdecea', '#c0392b'],
  mixed: ['#fff3e0', '#b7791f'],
  na:    ['#f0f2f5', '#6b7a8c'],
};

function VerdictBadge({ v }: { v: string }) {
  const [bg, color] = VERDICT_STYLE[v] ?? ['#f0f2f5', '#6b7a8c'];
  return <span className="v-badge" style={{ background: bg, color }}>{v}</span>;
}

function OverallBadge({ v }: { v: Section['overall_verdict'] }) {
  const [bg, color] = OVERALL_STYLE[v];
  return (
    <span className="v-badge v-badge-upper" style={{ background: bg, color }}>
      {v}
    </span>
  );
}

// ── validation error view ──────────────────────────────────────────────────

function ValidationErrorView({ error }: { error: MemoValidationError }) {
  return (
    <div className="card memo-error-card">
      <h2 className="memo-error-heading">Payload Validation Failed</h2>
      <p className="meta">Ratified schema v{SCHEMA_VERSION} — this payload did not pass the boundary gate.</p>
      <ul className="memo-error-list">
        {error.errors.map((e, i) => <li key={i}>{e}</li>)}
      </ul>
    </div>
  );
}

// ── report header ──────────────────────────────────────────────────────────

function ReportHeader({ memo }: { memo: Memo }) {
  const href = tryHref(memo.companyUrl);
  return (
    <div className="report-header">
      <div className="report-header-inner">
        <div>
          <h1 className="report-company">{memo.companyName}</h1>
          <div className="report-meta-row">
            {href
              ? <a href={href} target="_blank" rel="noreferrer" className="report-url">{memo.companyUrl}</a>
              : <span className="report-url">{memo.companyUrl}</span>}
            <span className="report-sep">·</span>
            <span>{memo.industry}</span>
            <span className="report-sep">·</span>
            <span>{memo.runDate}</span>
          </div>
          <div className="report-preparer">Prepared by {memo.preparer}</div>
        </div>
        <span className="platform-badge">{memo.platform}</span>
      </div>
    </div>
  );
}

// ── tally strip ────────────────────────────────────────────────────────────

function TallyStrip({ memo }: { memo: Memo }) {
  // Compute from checks for data-integrity check only — display uses ratified tally.
  const computed = { fail: 0, flag: 0, pass: 0, na: 0 };
  for (const s of memo.sections) {
    for (const c of s.checks) {
      if      (c.verdict === 'FAIL') computed.fail++;
      else if (c.verdict === 'FLAG') computed.flag++;
      else if (c.verdict === 'PASS') computed.pass++;
      else if (c.verdict === 'N/A')  computed.na++;
    }
  }
  const mismatch = (
    computed.fail !== memo.tallyFail || computed.flag !== memo.tallyFlag ||
    computed.pass !== memo.tallyPass || computed.na   !== memo.tallyNa
  );
  if (mismatch) {
    console.warn(
      '[CoSuite AM] Tally mismatch — ratified tally is displayed; computed totals differ.',
      { ratified: { fail: memo.tallyFail, flag: memo.tallyFlag, pass: memo.tallyPass, na: memo.tallyNa }, computed }
    );
  }

  const chips: [number, string, string, string][] = [
    [memo.tallyFail, 'FAIL', '#c0392b', '#fdecea'],
    [memo.tallyFlag, 'FLAG', '#b7791f', '#fef9ec'],
    [memo.tallyPass, 'PASS', '#1e7f5c', '#e8f6f0'],
    [memo.tallyNa,   'N/A',  '#6b7a8c', '#f0f2f5'],
  ];

  return (
    <div className="tally-strip">
      {chips.map(([count, label, color, bg]) => (
        <div key={label} className="tally-chip" style={{ background: bg, borderColor: color }}>
          <span className="tally-count" style={{ color }}>{count}</span>
          <span className="tally-label" style={{ color }}>{label}</span>
        </div>
      ))}
      {mismatch && (
        <div className="tally-mismatch">
          Displayed tally from ratified payload; computed check totals differ — see console.
        </div>
      )}
    </div>
  );
}

// ── executive summary ──────────────────────────────────────────────────────

function ExecIssueCard({ issue }: { issue: ExecIssue }) {
  return (
    <div className={`exec-issue${issue.reg_flag ? ' exec-issue-reg' : ''}`}>
      {issue.reg_flag && <span className="reg-marker">Regulatory</span>}
      <div className="exec-issue-title">{issue.title}</div>
      <div className="exec-field">
        <span className="field-lbl">Discovery</span>
        <span>{issue.discovered_issue}</span>
      </div>
      <div className="exec-field">
        <span className="field-lbl">Resolution</span>
        <span>{issue.resolution}</span>
      </div>
      <div className="exec-field">
        <span className="field-lbl">Checks</span>
        <code className="check-codes">{issue.check_codes}</code>
      </div>
    </div>
  );
}

function ExecSummary({ memo, onTabSelect }: { memo: Memo; onTabSelect: (id: string) => void }) {
  const [open, setOpen] = useState(true);
  const custody = memo.custodyPredicateIssue;
  const issues  = memo.execIssues;

  return (
    <div className="card exec-summary">
      <button className="exec-toggle" onClick={() => setOpen(o => !o)}>
        <strong>Executive Summary</strong>
        <span className="toggle-chevron">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="exec-body">
          {issues.length === 0 ? (
            <div className="exec-empty">
              No flagged or failed issues identified in this report.
            </div>
          ) : custody !== null ? (
            <>
              <div className="custody-label">
                ★ Unified chain-of-custody finding — governs all section findings
              </div>
              <ExecIssueCard issue={custody} />
              {issues.filter(i => !i.custody_predicate).length > 0 && (
                <div className="stub-list">
                  {issues.filter(i => !i.custody_predicate).map((issue, idx) => {
                    const secId = sectionFromCodes(issue.check_codes);
                    return (
                      <div key={idx} className="exec-stub">
                        <span className="stub-title">{issue.title}</span>
                        <code className="stub-codes">{issue.check_codes}</code>
                        {secId && (
                          <button className="stub-link" onClick={() => onTabSelect(secId)}>
                            → Section {secId}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          ) : (
            issues.map((issue, idx) => <ExecIssueCard key={idx} issue={issue} />)
          )}
        </div>
      )}
    </div>
  );
}

// ── section tabs ───────────────────────────────────────────────────────────

function FindingCard({ finding }: { finding: Finding }) {
  return (
    <div className={`finding${finding.reg_flag ? ' finding-reg' : ''}`}>
      {finding.reg_flag && <span className="reg-marker">Regulatory</span>}
      <div className="finding-title">{finding.title}</div>
      <div className="finding-field">
        <span className="field-lbl">Discovery</span>
        <span>{finding.audit_discovery}</span>
      </div>
      <div className="finding-field">
        <span className="field-lbl">Resolution</span>
        <span>{finding.resolution}</span>
      </div>
      {finding.source_links.length > 0 && (
        <div className="finding-field">
          <span className="field-lbl">Sources</span>
          <span>
            {finding.source_links.map((sl, i) => {
              const href = tryHref(sl.url);
              return (
                <span key={i}>
                  {i > 0 && ', '}
                  {href
                    ? <a href={href} target="_blank" rel="noreferrer">{sl.label}</a>
                    : <span>{sl.label}{sl.url ? ` (${sl.url})` : ''}</span>}
                </span>
              );
            })}
          </span>
        </div>
      )}
    </div>
  );
}

function SectionPanel({ section }: { section: Section }) {
  return (
    <div className="section-panel">
      <div className="section-panel-head">
        <div className="section-panel-title">
          <span className="section-id-badge">{section.id}</span>
          <span className="section-name">{section.title}</span>
        </div>
        <div className="section-panel-meta">
          <span className="section-tally-label">{section.tally_label}</span>
          <OverallBadge v={section.overall_verdict} />
        </div>
      </div>

      {section.triage_label && (
        <div className={`triage-label${section.triage_is_reg ? ' triage-reg' : ''}`}>
          {section.triage_is_reg ? '⚠ ' : ''}{section.triage_label}
        </div>
      )}

      {section.findings.length > 0 && (
        <div className="findings-list">
          {section.findings.map((f, i) => <FindingCard key={i} finding={f} />)}
        </div>
      )}

      {section.clean_line && (
        <div className="clean-line">✔ {section.clean_line}</div>
      )}

      {section.checks.length > 0 && (
        <table className="checks-table">
          <thead>
            <tr>
              <th>Code</th><th>Check</th><th>Verdict</th><th>Finding</th>
            </tr>
          </thead>
          <tbody>
            {section.checks.map((c, i) => (
              <tr key={i}>
                <td className="check-code-cell">{c.code}</td>
                <td>{c.name}</td>
                <td><VerdictBadge v={c.verdict} /></td>
                <td>{c.finding}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function SectionTabs({ memo, active, onSelect }: {
  memo: Memo; active: string; onSelect: (id: string) => void;
}) {
  return (
    <div className="sections-container">
      <div className="tab-bar" role="tablist">
        {memo.sections.map(s => (
          <button
            key={s.id} role="tab"
            aria-selected={s.id === active}
            className={`tab-btn${s.id === active ? ' tab-btn-active' : ''}`}
            onClick={() => onSelect(s.id)}
          >
            <span className="tab-section-id">{s.id}</span>
            <span className="tab-section-name">{s.title}</span>
            <OverallBadge v={s.overall_verdict} />
          </button>
        ))}
      </div>
      {memo.sections.map(s => (
        <div
          key={s.id} role="tabpanel"
          className={`tab-panel${s.id === active ? ' tab-panel-active' : ''}`}
        >
          <SectionPanel section={s} />
        </div>
      ))}
    </div>
  );
}

// ── sources ────────────────────────────────────────────────────────────────

function SourcesSection({ memo }: { memo: Memo }) {
  return (
    <div className="card sources-section">
      <h3 className="sources-heading">Sources</h3>
      {memo.sourceGroups.map((group, gi) => (
        <div key={gi} className="source-group">
          <div className="source-group-label">{group.label}</div>
          <table>
            <tbody>
              {group.items.map((item, ii) => {
                const href = tryHref(item.url);
                return (
                  <tr key={ii}>
                    <td className="source-name">
                      {href
                        ? <a href={href} target="_blank" rel="noreferrer">{item.name}</a>
                        : item.name}
                    </td>
                    <td className="source-detail">{item.detail}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ))}
      <div className="sources-note">{memo.sourcesNote}</div>
    </div>
  );
}

// ── fixture picker (dev / review helper) ───────────────────────────────────

function FixturePicker() {
  const current = new URLSearchParams(window.location.search).get('fixture') ?? 'example-memo';
  return (
    <div className="fixture-picker">
      <span className="fixture-picker-label">Fixture:</span>
      {Object.keys(FIXTURES).map(k => (
        <a key={k} href={`/memo?fixture=${k}`} className={k === current ? 'fixture-active' : ''}>
          {k}
        </a>
      ))}
    </div>
  );
}

// ── root report ────────────────────────────────────────────────────────────

function MemoReport({ memo }: { memo: Memo }) {
  const firstId = memo.sections[0]?.id ?? 'A';
  const [activeTab, setActiveTab] = useState(firstId);
  return (
    <div className="memo-report">
      <ReportHeader memo={memo} />
      <TallyStrip memo={memo} />
      <ExecSummary memo={memo} onTabSelect={setActiveTab} />
      <SectionTabs memo={memo} active={activeTab} onSelect={setActiveTab} />
      <SourcesSection memo={memo} />
    </div>
  );
}

export default function MemoView() {
  const key = new URLSearchParams(window.location.search).get('fixture') ?? 'example-memo';
  const raw = FIXTURES[key];

  let content: React.ReactNode;
  if (raw === undefined) {
    content = (
      <div className="card empty">
        Unknown fixture "{key}". Available: {Object.keys(FIXTURES).join(', ')}
      </div>
    );
  } else {
    try {
      content = <MemoReport memo={Memo.parse(raw)} />;
    } catch (e) {
      if (e instanceof MemoValidationError) {
        content = <ValidationErrorView error={e} />;
      } else {
        throw e;
      }
    }
  }

  return (
    <>
      <FixturePicker />
      {content}
    </>
  );
}
