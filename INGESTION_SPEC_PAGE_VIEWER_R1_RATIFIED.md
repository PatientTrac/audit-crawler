---
document: INGESTION_SPEC_PAGE_VIEWER
version: R1 — RATIFIED
canonical: CANONICAL 49 R1
status: RATIFIED. Operator dispositioned all open decisions 2026-07-15. Section 7 is UNLOCKED.
         Stamped CANONICAL 49 R1 against Truth Table T7 (2026-07-10) by registry maintainer 2026-07-15.
date: 2026-07-15
supersedes: R0-DRAFT (2026-07-15)
scope: Stage 1 ingestion + the page viewer — how a subject page's visitor-equivalent state is
       captured, recorded, and displayed, and how honest absence is recorded when it cannot be.
governed_by: CANONICAL 37 R5 (evidence integrity / source-URL / Rule 6 gate), CANONICAL 19 R7
             (fabrication boundary; §2.1.1 HALT; §2.2.1 no named entity from training; §2.6
             Verification Freshness; §2.8 Tool-Use Capability Verification Gate), CANONICAL 14 R3
             (binding bands), Addendum E1-A R1 (Reachability Gate on Honest Absence), Addendum
             E1-B R1 (Lens Yield), CANONICAL 48 R1 (discovery layer).
authority: Truth Table T7 (2026-07-10).
grounding: §3, §4, §6 dispositions verified against audit-crawler source 2026-07-15
           (crawl.ts, evidence.ts, wayback.ts, single.ts).
---

# Page Viewer Ingestion Spec — CANONICAL 49 R1

## 0. Why this exists
A plain HTTP fetch of a single-page application returns the app shell, not what a visitor sees.
An audit reading that shell as "the page" would record a false absence. This spec fixes the
ingestion discipline that prevents it. "Compliant" here means compliant with THIS ingestion
discipline — never a compliance claim about the subject (see GOVERNANCE_LAYER_DISCLAIMER.md).

## 1. Boundary
The viewer renders and displays; it does not audit, score, or interpret. Under the ratified
fetch model (§6.1) it does not fetch or render either — it displays evidence already captured
by the crawler.

## 2. The three ingestion outcomes (exhaustive, recorded, never inferred)
1. **Full render** — visitor-equivalent post-JS DOM captured. Only this may be displayed as "the page."
2. **Partial / shell only** — response came back, content did not materialize. Never displayed as
   whole. Recorded as honest absence (`rendered-empty-after-js` / `render-timeout`).
3. **Unreachable** — no usable response. Recorded as honest absence per the §6.4 taxonomy.
Outcomes 2 and 3 are governed by **Addendum E1-A**: absence is reserved for the genuinely
unreachable; a reachable page that merely needs JS is a read to perform, not an absence.

## 3. Render discipline — RATIFIED as HEADLESS-ALWAYS  *(corrected from R0 against crawl.ts)*
3.1 **Headless-always.** The crawler launches Chromium unconditionally and captures
    `page.content()` after `waitUntil: 'networkidle'` — i.e. after JavaScript has executed and
    network activity settled. There is NO static-first phase; the stored DOM is already the
    visitor-equivalent rendered state, and the sha256 is hashed over that post-JS DOM. Under-render
    detection is therefore a crawler-side concern only, and under §6.1 = A the viewer never needs it.
3.2 **Capability probe (19 R7 §2.8)** applies crawler-side, before the render cell, logged. If the
    render capability is unavailable the crawler records `render-capability-unavailable`; it does not
    store a shell as if it were the page. The viewer, displaying stored evidence, does not render and
    so does not re-run this probe.
3.3 **No content from training (19 R7 §2.2.1).** Only what was retrieved from the subject URL is
    displayed. Empty stays empty.
3.4 **Freshness (19 R7 §2.6).** Every capture carries its retrieval timestamp; the viewer shows it.

## 4. Provenance per capture (37 R5) — RATIFIED against evidence.ts
- `requested_url`, `final_url` (post-redirect)
- `http_status` (null if no response)
- `render_mode` — fixed `headless` under the ratified model
- `capture_sha256` — hash of the post-JS DOM (null on unreachable)
- `screenshot_ref` — full-page PNG, **always populated**
- `pdf_ref` — A4 PDF, **nullable** (fails silently in non-Chromium contexts, set null)
- `wayback_url` — populated separately in single.ts
- `captured_at` (UTC)
- `absence_class` — null on full render; else one §6.4 value
- `probe_result` — the 19 R7 §2.8 crawler-side probe outcome
Raw static HTML is **not** captured (post-JS DOM only). Record is append-only; a re-capture is a new row.

## 5. Display contract
5.1 Full renders display as the visitor-equivalent view; `render_mode` + `captured_at` visible.
5.2 Honest-absence states are **first-class**, never blank: outcome 2 → explicit "did not fully
    render — <class>"; outcome 3 → explicit "unreachable — <class>". Both show what was attempted.
5.3 No blending of partial capture with placeholder/inferred content. Partial shows as partial.

## 6. DISPOSITIONS (operator, 2026-07-15)

### 6.1 — Fetch path → **A: DISPLAY-OF-RECORD.** RATIFIED.
The crawler already renders and stores the visitor-equivalent capture. The viewer displays that
evidence of record; it never re-fetches or re-renders at view time. One capture, one hash, one
timestamp — chain-of-custody intact. Option B (view-time re-fetch) is rejected: it manufactures a
second capture divergent from the audited evidence, a custody break.

### 6.2 — Under-render signal → **COLLAPSED.** Crawler-side only (`blocked` + `block_detail` in
`evidence_page`). Not a viewer concern under 6.1 = A.

### 6.3 — Capture set → **RATIFIED by what the crawler stores:** post-JS DOM + full-page screenshot
(always) + wayback URL; PDF nullable. No raw static HTML. Viewer displays DOM, screenshot, and
wayback link; PDF when present.

### 6.4 — Absence taxonomy → **RATIFIED AS PROPOSED.** Maps to the crawler's `block_detail`:
`unreachable-network | bot-wall | auth-wall | robots-disallowed | render-timeout |
rendered-empty-after-js | render-capability-unavailable | dns-failure`.
Downstream memo schema keys off this enumeration; it is now fixed.

### 6.5 — Bot-wall posture → **FINDING.** RATIFIED. A subject blocking automated audit access is
itself a compliance-surface signal, not a neutral gap. Recorded as `blocked=true` with
`block_detail=bot-wall` AND surfaced as a finding in the memo.

### 6.6 — Render engine/host → **COLLAPSED.** Playwright/Chromium in the crawler. Colab render moot.

### 6.7 — Robots-disallowed handling → **NEW DISPOSITION (from crawler code review).**
The crawler currently `continue`s past robots-disallowed URLs silently — no row, no flag. That is an
**E1-A violation** (a honest absence that must be recorded is instead dropped without trace) and it
contradicts the 6.4 taxonomy. RATIFIED fix:
- **The crawler MUST write a `robots-disallowed` absence row before skipping.** Silent `continue` is
  removed. This is a required crawler-side code fix, non-optional.
- **Classification:** a `robots-disallowed` absence is a **neutral recorded absence by default**
  (robots.txt boilerplate disallows — /admin, /cart, /search — are normal hygiene, not signal). It
  **escalates to a finding** (same class as 6.5 bot-wall) **only when the disallowed URL was
  audit-relevant** — i.e. it scored above the crawl threshold / was in the discovery set. This keeps
  E1-A satisfied (always recorded) without over-firing on benign disallows, and aligns with 6.5 where
  it actually matters.

## 7. UNLOCKED — Builder action
The viewer is **display-of-record**: read the crawler's stored evidence (post-JS DOM + screenshot +
wayback) and display it faithfully, with honest-absence states rendered first-class per §5.2 and the
§6.4 taxonomy. No fetch, no render, no re-capture at view time. A gap the ratified spec doesn't cover
returns here as a new decision request — the Builder does not extend the spec itself.

Crawler-side, one required fix precedes clean operation: the §6.7 robots-disallowed absence row.

## 8. Canon registration — STAMPED

| Field | Value |
|-------|-------|
| Canonical number | CANONICAL 49 R1 |
| Authority | Truth Table T7 (2026-07-10) |
| Placement | New CANONICAL — Stage 1 ingestion discipline (display-of-record fetch model) |
| Stamped | 2026-07-15 |
| Governed by | CANONICAL 37 R5, 19 R7, 14 R3, Addendum E1-A R1, E1-B R1, CANONICAL 48 R1 |
| Required crawler fix | §6.7 robots-disallowed absence row (E1-A violation) — committed same date |
| Registry entry | CANONICAL_REGISTRY.md row 49 |

---
END — CANONICAL 49 R1. RATIFIED 2026-07-15. Stamped 2026-07-15.
