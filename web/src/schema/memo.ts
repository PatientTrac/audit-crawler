// Browser-compatible Memo accessor class.
// Mirrors src/schema/memo.ts — all memo field access in components goes through here.
import { validateMemo, SCHEMA_VERSION } from './validate';
import type { MemoInput } from './memo.types';

export class Memo {
  private constructor(private readonly data: MemoInput) {}

  static parse(payload: unknown): Memo {
    return new Memo(validateMemo(payload) as MemoInput);
  }

  // ── meta ─────────────────────────────────────────────────────────────────
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

  // ── tally ─────────────────────────────────────────────────────────────────
  /** spec: tally.fail */
  get tallyFail(): number { return this.data.tally.fail; }
  /** spec: tally.flag */
  get tallyFlag(): number { return this.data.tally.flag; }
  /** spec: tally.pass */
  get tallyPass(): number { return this.data.tally.pass; }
  /** spec: tally.na */
  get tallyNa(): number { return this.data.tally.na; }

  // ── exec_issues ───────────────────────────────────────────────────────────
  /** spec: exec_issues[] — payload order preserved (Colab owns ordering) */
  get execIssues(): MemoInput['exec_issues'] { return this.data.exec_issues; }
  /** spec: exec_issues[*].custody_predicate — the at-most-one custody issue */
  get custodyPredicateIssue(): MemoInput['exec_issues'][number] | null {
    return this.data.exec_issues.find(i => i.custody_predicate) ?? null;
  }

  // ── sections ──────────────────────────────────────────────────────────────
  /** spec: sections[] */
  get sections(): MemoInput['sections'] { return this.data.sections; }
  /** spec: sections[*] by id */
  sectionById(id: string): MemoInput['sections'][number] | null {
    return this.data.sections.find(s => s.id === id) ?? null;
  }

  // ── sources ───────────────────────────────────────────────────────────────
  /** spec: sources.groups */
  get sourceGroups(): MemoInput['sources']['groups'] { return this.data.sources.groups; }
  /** spec: sources.note */
  get sourcesNote(): string { return this.data.sources.note; }

  get schemaVersion(): string { return SCHEMA_VERSION; }
}
