type PexelsPhoto = {
  id: number;
  width: number;
  height: number;
  url: string;
  photographer: string;
  photographer_url: string;
  alt: string;
  src: Record<string, string>;
};

export type PexelsSearchResult = {
  provider: 'pexels';
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

export const searchPexelsPhotos = async (query: string, count = 6): Promise<PexelsSearchResult[]> => {
  const apiKey = String(process.env.PEXEL_API ?? '').trim();
  if (!apiKey) throw new Error('PEXEL_API env var not set on backend');

  const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${Math.max(
    1,
    Math.min(30, count)
  )}`;

  const r = await fetch(url, { headers: { Authorization: apiKey } });
  if (!r.ok) {
    const text = await r.text().catch(() => '');
    throw new Error(`Pexels error ${r.status}: ${text.slice(0, 200)}`);
  }

  const data = (await r.json()) as { photos?: PexelsPhoto[] };
  const photos = data.photos ?? [];

  return photos.map((p) => {
    const best = p.src?.large2x ?? p.src?.large ?? p.src?.original;
    const thumb = p.src?.medium ?? p.src?.small;
    return {
      provider: 'pexels',
      providerId: String(p.id),
      kind: 'photo',
      title: p.alt || `Pexels Photo ${p.id}`,
      previewUrl: thumb,
      downloadUrl: best,
      sourceUrl: p.url,
      width: p.width,
      height: p.height,
      license: 'Pexels License',
      attribution: `${p.photographer} (Pexels)`,
      attributionUrl: p.photographer_url,
      altText: p.alt || `Photo related to: ${query}`
    };
  });
};

export const pickBestPhoto = (results: PexelsSearchResult[]): PexelsSearchResult | null => {
  if (!results.length) return null;

  // Basic scoring: prefer landscape-ish and with alt text
  const scored = results
    .map((r) => {
      const w = r.width ?? 0;
      const h = r.height ?? 0;
      const ratio = h ? w / h : 0;
      const landscapeScore = ratio >= 1.3 ? 1 : ratio >= 1.0 ? 0.5 : 0;
      const altScore = r.altText ? 0.2 : 0;
      return { r, score: landscapeScore + altScore };
    })
    .sort((a, b) => b.score - a.score);

  return scored[0]?.r ?? null;
};
