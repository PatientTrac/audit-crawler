/**
 * Fixture validation gate — runs as part of CI alongside check-schema-pin.mjs.
 * Valid payloads must pass; invalid payloads must throw MemoValidationError.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

// --- inline the validator (no TS compilation needed in CI script context) ---
// We load the derived JSON schema directly and run Ajv the same way validate.ts does.
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { createHash } from 'node:crypto';

const require = createRequire(import.meta.url);
const schema = require('../schema/derived/memo_input.schema.json');
const ratified = require('../schema/RATIFIED.json');

const ajv = new Ajv({ allErrors: true, strict: true });
addFormats(ajv);
const validator = ajv.compile(schema);

class MemoValidationError extends Error {
  constructor(errors) {
    super(`Memo payload failed schema validation (${ratified.version}):\n${errors.join('\n')}`);
    this.name = 'MemoValidationError';
  }
}

function assertCustodyPredicateAtMostOne(payload) {
  const issues = payload.exec_issues;
  if (!Array.isArray(issues)) return;
  const count = issues.filter(i => i.custody_predicate === true).length;
  if (count > 1) {
    throw new MemoValidationError([
      `custody_predicate: true on ${count} exec_issues; at most one permitted.`
    ]);
  }
}

function validateMemo(payload) {
  if (!validator(payload)) {
    throw new MemoValidationError(
      (validator.errors ?? []).map(e => `${e.instancePath || '/'} ${e.message}`)
    );
  }
  assertCustodyPredicateAtMostOne(payload);
  return payload;
}

// --- fixture runner ---
let passed = 0, failed = 0;

function runFixtures(dir, expectValid) {
  let files;
  try { files = readdirSync(dir).filter(f => f.endsWith('.json')); }
  catch { return; }

  for (const file of files) {
    const path = join(dir, file);
    const payload = JSON.parse(readFileSync(path, 'utf8'));
    const tag = expectValid ? 'VALID' : 'INVALID';
    try {
      validateMemo(payload);
      if (expectValid) {
        console.log(`  PASS  [${tag}] ${file}`);
        passed++;
      } else {
        console.error(`  FAIL  [${tag}] ${file} — expected MemoValidationError, but validation passed`);
        failed++;
      }
    } catch (err) {
      if (err.name === 'MemoValidationError') {
        if (!expectValid) {
          console.log(`  PASS  [${tag}] ${file} — correctly rejected: ${err.message.split('\n')[0]}`);
          passed++;
        } else {
          console.error(`  FAIL  [${tag}] ${file} — unexpected validation error: ${err.message}`);
          failed++;
        }
      } else {
        throw err; // unexpected error — rethrow
      }
    }
  }
}

console.log('\nFixture validation — ratified schema', ratified.version);
console.log('Valid fixtures:');
runFixtures('fixtures/valid', true);
console.log('Invalid fixtures:');
runFixtures('fixtures/invalid', false);
console.log(`\n${passed} passed, ${failed} failed.`);
if (failed > 0) process.exit(1);
