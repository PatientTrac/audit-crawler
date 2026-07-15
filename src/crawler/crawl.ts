import { chromium } from 'playwright';
import robotsParser from 'robots-parser';
import { scoreUrl } from './scorer.js';
import { captureEvidence, type Capture } from '../capture/evidence.js';
import { CONFIG } from '../config.js';

export interface CrawlResult { captures: Capture[]; discovered: ScoredUrl[]; }
export interface ScoredUrl { url: string; score: number; depth: number; }

export async function crawlDomain(
  domain: string,
  opts: { dryRun: boolean; runDir: string },
): Promise<CrawlResult> {
  const root = `https://${domain.replace(/^https?:\/\//, '')}`;
  const origin = new URL(root).origin;

  let robots: ReturnType<typeof robotsParser> | null = null;
  try {
    const txt = await (await fetch(`${origin}/robots.txt`)).text();
    robots = robotsParser(`${origin}/robots.txt`, txt);
  } catch { /* absent robots.txt = permitted */ }
  const allowed = (u: string) => !robots || robots.isAllowed(u, CONFIG.userAgent) !== false;

  const queue: ScoredUrl[] = [{ url: root, score: 999, depth: 0 }];
  const seen = new Set<string>([root]);
  const discovered: ScoredUrl[] = [];
  const captures: Capture[] = [];

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ userAgent: CONFIG.userAgent });
  const page = await ctx.newPage();

  try {
    while (queue.length && captures.length < CONFIG.maxPagesPerDomain) {
      queue.sort((a, b) => b.score - a.score);
      const item = queue.shift()!;
      if (!allowed(item.url)) {
        // §6.7 (CANONICAL 49 R1): record robots-disallowed absence before skipping.
        // Finding flag set only for audit-relevant URLs (score > default link score of 10).
        if (!opts.dryRun) {
          captures.push({
            url: item.url, finalUrl: item.url, status: null,
            sha256: '', htmlPath: '', screenshotPath: null, pdfPath: null,
            headers: {}, blocked: item.score > 10, blockDetail: 'robots-disallowed',
          });
        }
        continue;
      }

      if (!opts.dryRun || item.depth === 0) {
        const resp = await page.goto(item.url, {
          waitUntil: 'networkidle', timeout: CONFIG.navTimeoutMs,
        }).catch(() => null);
        if (!opts.dryRun) {
          captures.push(await captureEvidence(page, item.url, resp, opts.runDir));
        }
        const links: string[] = await page.$$eval('a[href]',
          as => as.map(a => (a as HTMLAnchorElement).href));
        for (const href of links) {
          try {
            const u = new URL(href, origin);
            if (u.origin !== origin) continue;
            const clean = u.origin + u.pathname;
            if (seen.has(clean)) continue;
            seen.add(clean);
            const score = scoreUrl(clean);
            if (score < 0 || item.depth + 1 > CONFIG.maxDepth) continue;
            const entry = { url: clean, score, depth: item.depth + 1 };
            queue.push(entry);
            discovered.push(entry);
          } catch { /* malformed href */ }
        }
        await new Promise(r => setTimeout(r, CONFIG.politeDelayMs));
      } else {
        discovered.push(item);
      }
    }
  } finally { await browser.close(); }

  return { captures, discovered };
}
