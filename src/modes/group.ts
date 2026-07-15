import { readFile } from 'node:fs/promises';
import { runSingle } from './single.js';

export async function runGroup(groupName: string, clientId?: string, file = 'src/targets/groups.example.json') {
  const groups = JSON.parse(await readFile(file, 'utf8'));
  const domains: string[] = groups[groupName];
  if (!domains) throw new Error(
    `Unknown group '${groupName}'. Available: ${Object.keys(groups).join(', ')}`);
  for (const d of domains) {
    console.log(`\n=== ${d} ===`);
    await runSingle(d, groupName, clientId);
  }
}
