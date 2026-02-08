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

import path from 'node:path';
import fs from 'node:fs/promises';

const cacheDir = path.resolve(process.cwd(), 'assets-cache');

const guessExt = (contentType: string | null): string => {
  const ct = (contentType ?? '').toLowerCase();
  if (ct.includes('png')) return 'png';
  if (ct.includes('webp')) return 'webp';
  return 'jpg';
};

const toDataUri = (contentType: string, base64: string): string => {
  return `data:${contentType};base64,${base64}`;
};

// Fetch/resolve an asset selection.
// Phase C implementation: download + cache + return base64 dataUri for Office.js insertion.
assetsRouter.post('/fetch', async (req, res) => {
  const downloadUrl = String(req.body?.downloadUrl ?? '').trim();
  const altText = String(req.body?.altText ?? '').trim();
  const attribution = String(req.body?.attribution ?? '').trim();
  const license = String(req.body?.license ?? '').trim();

  if (!downloadUrl) return res.status(400).json({ success: false, error: 'Missing downloadUrl' });

  try {
    const r = await fetch(downloadUrl);
    if (!r.ok) {
      return res.status(502).json({ success: false, error: `Asset download failed: ${r.status}` });
    }

    const contentType = r.headers.get('content-type') ?? 'image/jpeg';
    const buf = Buffer.from(await r.arrayBuffer());
    const base64 = buf.toString('base64');

    await fs.mkdir(cacheDir, { recursive: true });
    const ext = guessExt(contentType);
    const assetId = `asset-${Date.now()}`;
    const filePath = path.join(cacheDir, `${assetId}.${ext}`);
    await fs.writeFile(filePath, buf);

    return res.json({
      success: true,
      asset: {
        assetId,
        kind: 'photo',
        sourceUrl: downloadUrl,
        filePath,
        altText: altText || 'Stock photo',
        attribution: attribution || undefined,
        license: license || undefined,
        contentType,
        dataUri: toDataUri(contentType, base64)
      }
    });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e?.message ?? String(e) });
  }
});

// AI image generation (OpenAI) - fallback when stock isn't good enough.
assetsRouter.post('/generate-image', async (req, res) => {
  const prompt = String(req.body?.prompt ?? '').trim();
  const size = String(req.body?.size ?? '1536x1024').trim();

  if (!prompt) return res.status(400).json({ success: false, error: 'Missing prompt' });

  try {
    const { generateOpenAiImageBase64 } = await import('../services/openaiImages.js');
    const out = await generateOpenAiImageBase64({
      prompt,
      size: (size as any) || '1536x1024'
    });

    return res.json({
      success: true,
      asset: {
        assetId: `ai-${Date.now()}`,
        kind: 'photo',
        sourceUrl: undefined,
        altText: prompt,
        attribution: 'AI-generated (OpenAI)',
        license: 'AI-generated',
        contentType: 'image/png',
        dataUri: `data:image/png;base64,${out.b64}`,
        revisedPrompt: out.revisedPrompt
      }
    });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e?.message ?? String(e) });
  }
});
