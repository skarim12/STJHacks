import { Router } from 'express';

export const assetsRouter = Router();

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

const getPexelsKey = (): string | null => {
  const k = String(process.env.PEXEL_API ?? '').trim();
  return k || null;
};

// Phase C: stock asset search (Pexels). Stock preferred.
assetsRouter.post('/search', async (req, res) => {
  const query = String(req.body?.query ?? '').trim();
  const kind = String(req.body?.kind ?? 'photo');
  const perPage = Math.max(1, Math.min(10, Number(req.body?.count ?? 6)));

  if (!query) return res.status(400).json({ success: false, error: 'Missing query' });
  if (kind !== 'photo') {
    return res.json({
      success: true,
      query,
      kind,
      results: [],
      warnings: ['Only kind="photo" is implemented right now (Pexels).']
    });
  }

  const apiKey = getPexelsKey();
  if (!apiKey) {
    return res.status(500).json({
      success: false,
      error: 'PEXEL_API env var not set on backend'
    });
  }

  try {
    const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${perPage}`;
    const r = await fetch(url, {
      headers: {
        Authorization: apiKey
      }
    });

    if (!r.ok) {
      const text = await r.text().catch(() => '');
      return res.status(502).json({
        success: false,
        error: `Pexels error ${r.status}: ${text.slice(0, 200)}`
      });
    }

    const data = (await r.json()) as { photos?: PexelsPhoto[] };
    const photos = data.photos ?? [];

    const results = photos.map((p) => {
      const best = p.src?.large2x ?? p.src?.large ?? p.src?.original;
      const thumb = p.src?.medium ?? p.src?.small;
      return {
        provider: 'pexels',
        providerId: String(p.id),
        kind: 'photo' as const,
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

    return res.json({ success: true, query, kind, results });
  } catch (e: any) {
    return res.status(500).json({
      success: false,
      error: e?.message ?? String(e)
    });
  }
});

// Fetch/resolve an asset selection.
// For now we return URLs + attribution for preview; later we can download/transform/cache.
assetsRouter.post('/fetch', async (req, res) => {
  const downloadUrl = String(req.body?.downloadUrl ?? '').trim();
  const altText = String(req.body?.altText ?? '').trim();
  const attribution = String(req.body?.attribution ?? '').trim();
  const license = String(req.body?.license ?? '').trim();

  if (!downloadUrl) return res.status(400).json({ success: false, error: 'Missing downloadUrl' });

  return res.json({
    success: true,
    asset: {
      assetId: `asset-${Date.now()}`,
      kind: 'photo',
      sourceUrl: downloadUrl,
      altText: altText || 'Stock photo',
      attribution: attribution || undefined,
      license: license || undefined
    }
  });
});
