export async function requestWaybackSnapshot(url: string): Promise<string | null> {
  try {
    const res = await fetch(`https://web.archive.org/save/${encodeURIComponent(url)}`, {
      method: 'GET', redirect: 'follow',
    });
    const loc = res.headers.get('content-location');
    return loc ? `https://web.archive.org${loc}` : null;
  } catch { return null; }
}
