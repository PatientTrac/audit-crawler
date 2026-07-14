// Kept in sync with src/schema/memo.types.ts (generated from schema/derived/memo_input.schema.json).
// If the schema version changes, regenerate both from the derived schema.
// Do not edit by hand.

export interface MemoInput {
  _comment?: string;
  _instructions?: string;
  meta: {
    company_name: string;
    company_url: string;
    industry: string;
    run_date: string;
    preparer: string;
    platform: string;
  };
  tally: {
    fail: number;
    flag: number;
    pass: number;
    na: number;
  };
  exec_issues: {
    _comment?: string;
    title: string;
    resolution: string;
    discovered_issue: string;
    check_codes: string;
    reg_flag: boolean;
    custody_predicate: boolean;
  }[];
  sections: {
    id: string;
    title: string;
    tally_label: string;
    overall_verdict: 'mixed' | 'pass' | 'flag' | 'fail' | 'na';
    triage_label: string | null;
    triage_is_reg: boolean;
    clean_line: string | null;
    findings: {
      title: string;
      resolution: string;
      audit_discovery: string;
      reg_flag: boolean;
      source_links: {
        label: string;
        url: string | null;
      }[];
    }[];
    checks: {
      code: string;
      name: string;
      verdict: 'PASS' | 'FLAG' | 'FAIL' | 'N/A';
      finding: string;
    }[];
  }[];
  sources: {
    groups: {
      label: string;
      items: {
        name: string;
        detail: string;
        url: string | null;
      }[];
    }[];
    note: string;
  };
}
