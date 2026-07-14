import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const schema = readFileSync('schema/memo_input_SCHEMA.json');
const pin = JSON.parse(readFileSync('schema/RATIFIED.json', 'utf8'));
const actual = createHash('sha256').update(schema).digest('hex');

if (pin.sha256.startsWith('SET_FROM')) {
  console.error('RATIFIED.json not initialized — set version + sha256 from ratification log.');
  process.exit(1);
}
if (actual !== pin.sha256) {
  console.error(`Schema file hash ${actual} does not match ratified pin ${pin.sha256}.`);
  console.error('Either the schema was edited locally (forbidden) or RATIFIED.json was not updated with the new ratified version.');
  process.exit(1);
}
console.log(`Schema pin OK — ratified ${pin.version}`);
