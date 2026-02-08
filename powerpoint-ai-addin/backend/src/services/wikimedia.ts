export type WikimediaSearchResult = {
  provider: 'wikimedia';
  providerId: string;
  kind: 'photo';
  title: string;
  previewUrl?: string;
  downloadUrl: string;
  sourceUrl?: string;
  width?: number;
  height?: number;
  license?: string;
  attribution?: string;
  attributionUrl?: string;
  altText: string;
};

// Simple Wikimedia Commons image search.
// No API key required.
export async function searchWikimediaCommonsImages(
  query: string,
  count = 6
): Promise<WikimediaSearchResult[]> {
  const q = String(query || '').trim();
  if (!q) return [];

  // Use generator=search to find files; restrict to File: namespace.
  const url =
    'https://commons.wikimedia.org/w/api.php' +
    `?action=query` +
    `&generator=search` +
    `&gsrnamespace=6` +
    `&gsrsearch=${encodeURIComponent(q)}` +
    `&gsrlimit=${encodeURIComponent(String(Math.max(1, Math.min(20, count))))}` +
    `&prop=imageinfo` +
    `&iiprop=url|size|extmetadata` +
    `&iiurlwidth=800` +
    `&format=json` +
    `&origin=*`;

  const r = await fetch(url);
  if (!r.ok) {
    const t = await r.text().catch(() => '');
    throw new Error(`Wikimedia error ${r.status}: ${t.slice(0, 200)}`);
  }

  const data: any = await r.json();
  const pages: any[] = data?.query?.pages ? Object.values(data.query.pages) : [];

  const results: WikimediaSearchResult[] = [];
  for (const p of pages) {
    const pageId = String(p?.pageid ?? '');
    const title = String(p?.title ?? '').replace(/^File:/i, '').trim();
    const ii = Array.isArray(p?.imageinfo) ? p.imageinfo[0] : null;
    if (!ii) continue;

    // IMPORTANT: ii.url can be SVG for many commons files. Office.js/PPTX pipelines
    // are much more reliable with raster images (jpg/png). Wikimedia provides thumburl
    // (rasterized) when iiurlwidth is set, even for SVG.
    const previewUrl = String(ii?.thumburl ?? '').trim();
    const downloadUrl = String((previewUrl || ii?.url) ?? '').trim();
    if (!downloadUrl) continue;

    const ext = ii?.extmetadata ?? {};
    const license =
      String(ext?.LicenseShortName?.value ?? ext?.License?.value ?? '').replace(/<[^>]+>/g, '').trim() ||
      'Wikimedia Commons';

    const artistRaw = String(ext?.Artist?.value ?? '').trim();
    const artist = artistRaw.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

    const attribution = artist ? `${artist} (Wikimedia Commons)` : 'Wikimedia Commons';

    const descUrlRaw = String(ext?.AttributionURL?.value ?? ext?.ImageDescription?.value ?? '').trim();
    const attributionUrl = descUrlRaw ? descUrlRaw.replace(/<[^>]+>/g, '').trim() : undefined;

    const sourceUrl = `https://commons.wikimedia.org/wiki/${encodeURIComponent(String(p?.title ?? ''))}`;

    results.push({
      provider: 'wikimedia',
      providerId: pageId || title || downloadUrl,
      kind: 'photo',
      title: title || `Wikimedia File ${pageId}`,
      previewUrl: previewUrl || undefined,
      downloadUrl,
      sourceUrl,
      width: Number(ii?.width ?? 0) || undefined,
      height: Number(ii?.height ?? 0) || undefined,
      license,
      attribution,
      attributionUrl,
      altText: title ? `Image: ${title}` : `Image related to: ${q}`
    });
  }

  return results;
}

export function pickBestWikimediaImage(results: WikimediaSearchResult[]): WikimediaSearchResult | null {
  if (!results.length) return null;

  // Prefer landscape images (ppt-friendly).
  const scored = results
    .map((r) => {
      const w = r.width ?? 0;
      const h = r.height ?? 0;
      const ratio = h ? w / h : 0;
      const landscapeScore = ratio >= 1.3 ? 1 : ratio >= 1.0 ? 0.5 : 0;
      const previewScore = r.previewUrl ? 0.1 : 0;
      return { r, score: landscapeScore + previewScore };
    })
    .sort((a, b) => b.score - a.score);

  return scored[0]?.r ?? null;
}
