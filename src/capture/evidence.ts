import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Page, Response } from 'playwright';

export interface Capture {
  url: string; finalUrl: string; status: number | null;
  sha256: string; htmlPath: string; screenshotPath: string | null;
  pdfPath: string | null; headers: Record<string, string>;
  blocked: boolean; blockDetail: string | null;
}

const BOT_WALL_SIGNS = ['cf-chl', 'challenge-platform', 'just a moment',
  'access denied', 'captcha'];

export async function captureEvidence(
  page: Page, url: string, response: Response | null, runDir: string,
): Promise<Capture> {
  await mkdir(runDir, { recursive: true });
  const html = await page.content();
  const sha256 = createHash('sha256').update(html).digest('hex');
  const base = join(runDir, sha256.slice(0, 16));

  const htmlPath = `${base}.html`;
  await writeFile(htmlPath, html, 'utf8');
  const screenshotPath = `${base}.png`;
  await page.screenshot({ path: screenshotPath, fullPage: true });

  let pdfPath: string | null = `${base}.pdf`;
  try { await page.pdf({ path: pdfPath, format: 'A4' }); }
  catch { pdfPath = null; }

  const lower = html.toLowerCase();
  const blocked = BOT_WALL_SIGNS.some(s => lower.includes(s));

  return {
    url, finalUrl: page.url(),
    status: response?.status() ?? null,
    sha256, htmlPath, screenshotPath, pdfPath,
    headers: response ? await response.allHeaders() : {},
    blocked,
    blockDetail: blocked ? 'anti-bot challenge detected; recorded as finding' : null,
  };
}
