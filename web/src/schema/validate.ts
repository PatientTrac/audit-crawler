// Browser-compatible boundary validator.
// Mirrors src/schema/validate.ts; JSON imports use Vite syntax (no assert).
import Ajv, { type ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';
import schema from '../../../schema/derived/memo_input.schema.json';
import ratified from '../../../schema/RATIFIED.json';

const ajv = new Ajv({ allErrors: true, strict: true });
addFormats(ajv);
const validator: ValidateFunction = ajv.compile(schema as object);

export class MemoValidationError extends Error {
  constructor(public readonly errors: string[]) {
    super(
      `Memo payload failed validation against ratified schema ` +
      `${ratified.version}:\n${errors.join('\n')}`
    );
    this.name = 'MemoValidationError';
  }
}

/**
 * Cross-field check: custody_predicate must be true on AT MOST ONE exec_issue.
 * Not expressible in JSON Schema — see DERIVATION_NOTES.md §5.
 */
function assertCustodyPredicateAtMostOne(payload: Record<string, unknown>): void {
  const issues = payload.exec_issues as Array<{ custody_predicate: boolean }> | undefined;
  if (!Array.isArray(issues)) return;
  const count = issues.filter(i => i.custody_predicate === true).length;
  if (count > 1) {
    throw new MemoValidationError([
      `custody_predicate: true on ${count} exec_issues; at most one permitted (TICKET-9, DERIVATION_NOTES §5).`,
    ]);
  }
}

/** Single entry point for memo JSON entering the UI. Throws — never coerces. */
export function validateMemo(payload: unknown): unknown {
  if (!validator(payload)) {
    throw new MemoValidationError(
      (validator.errors ?? []).map(e => `${e.instancePath || '/'} ${e.message}`)
    );
  }
  assertCustodyPredicateAtMostOne(payload as Record<string, unknown>);
  return payload;
}

export const SCHEMA_VERSION: string = ratified.version;
