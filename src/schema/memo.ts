import { validateMemo, SCHEMA_VERSION } from './validate.js';
import type { MemoInput } from './memo.types.js';

/**
 * The ONLY place raw memo payload is touched. Components import Memo,
 * never the payload. Unratified field access = TypeScript error here,
 * not a runtime surprise in a component.
 *
 * Accessors map 1-to-1 to ratified spec paths in memo_input_SCHEMA.json v1.0.
 */
export class Memo {
  private constructor(private readonly data: MemoInput) {}

  static parse(payload: unknown): Memo {
    return new Memo(validateMemo(payload) as MemoInput);
  }

  // ── schema: meta ──────────────────────────────────────────────────────────

  /** spec: meta.company_name */
  get companyName(): string { return this.data.meta.company_name; }

  /** spec: meta.company_url */
  get companyUrl(): string { return this.data.meta.company_url; }

  /** spec: meta.industry */
  get industry(): string { return this.data.meta.industry; }

  /** spec: meta.run_date */
  get runDate(): string { return this.data.meta.run_date; }

  /** spec: meta.preparer */
  get preparer(): string { return this.data.meta.preparer; }

  /** spec: meta.platform */
  get platform(): string { return this.data.meta.platform; }

  // ── schema: tally ─────────────────────────────────────────────────────────

  /** spec: tally.fail */
  get tallyFail(): number { return this.data.tally.fail; }

  /** spec: tally.flag */
  get tallyFlag(): number { return this.data.tally.flag; }

  /** spec: tally.pass */
  get tallyPass(): number { return this.data.tally.pass; }

  /** spec: tally.na */
  get tallyNa(): number { return this.data.tally.na; }

  // ── schema: exec_issues ───────────────────────────────────────────────────

  /** spec: exec_issues[] — ordered as received (regulatory items first per spec) */
  get execIssues(): MemoInput['exec_issues'] { return this.data.exec_issues; }

  /**
   * spec: exec_issues[*].custody_predicate — the single issue (if any) marked
   * as the unified absence of human review authority, external verification,
   * and tamper-evident generation record.
   */
  get custodyPredicateIssue(): MemoInput['exec_issues'][number] | null {
    return this.data.exec_issues.find(i => i.custody_predicate) ?? null;
  }

  // ── schema: sections ──────────────────────────────────────────────────────

  /** spec: sections[] — full list */
  get sections(): MemoInput['sections'] { return this.data.sections; }

  /** spec: sections[*] by id (A–F) */
  sectionById(id: string): MemoInput['sections'][number] | null {
    return this.data.sections.find(s => s.id === id) ?? null;
  }

  // ── schema: sources ───────────────────────────────────────────────────────

  /** spec: sources.groups */
  get sourceGroups(): MemoInput['sources']['groups'] { return this.data.sources.groups; }

  /** spec: sources.note */
  get sourcesNote(): string { return this.data.sources.note; }

  // ── meta ──────────────────────────────────────────────────────────────────

  get schemaVersion(): string { return SCHEMA_VERSION; }
}
