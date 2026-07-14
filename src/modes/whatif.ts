import { crawlDomain } from '../crawler/crawl.js';

export async function runWhatIf(domain: string) {
  const { discovered } = await crawlDomain(domain, {
    dryRun: true, runDir: '/tmp/whatif',
  });
  const plan = discovered.sort((a, b) => b.score - a.score);
  const high = plan.filter(p => p.score >= 100);

  console.log(`\nWHAT-IF PLAN — ${domain}`);
  console.log(`Discoverable in-scope URLs: ${plan.length}`);
  console.log(`High-priority (governance/trust/compliance): ${high.length}`);
  console.log(`Estimated capture time: ~${Math.ceil(plan.length * 2.5 / 60)} min\n`);
  for (const p of plan.slice(0, 25))
    console.log(`  [${String(p.score).padStart(3)}] ${p.url}`);
  if (high.length === 0)
    console.log('\nWARNING: no governance/compliance surface discovered from homepage nav.' +
      '\nThat absence is itself a preliminary signal - verify with full run.');
  return plan;
}
