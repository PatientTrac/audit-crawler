const HIGH = ['governance','trust','compliance','responsible-ai','ai-policy',
  'security','legal','disclosure','privacy','audit','risk','ethics'];
const MED  = ['about','policy','terms','whitepaper','documentation','faq'];
const SKIP = ['blog','careers','press','media','signin','login','cart',
  'pricing','#','mailto:','tel:'];

export function scoreUrl(url: string): number {
  const u = url.toLowerCase();
  if (SKIP.some(k => u.includes(k))) return -1;
  if (HIGH.some(k => u.includes(k))) return 100;
  if (MED.some(k => u.includes(k)))  return 50;
  return 10;
}
