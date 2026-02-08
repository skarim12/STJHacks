import { Router } from 'express';

export const assetsRouter = Router();

// Phase C placeholder: search assets (photos/icons)
// Later: integrate providers (Unsplash/Pexels, Iconify) with licensing enforcement.
assetsRouter.post('/search', async (req, res) => {
  const query = String(req.body?.query ?? '').trim();
  if (!query) return res.status(400).json({ success: false, error: 'Missing query' });

  return res.json({
    success: true,
    query,
    results: [
      {
        assetId: `placeholder-${Date.now()}`,
        kind: 'photo',
        title: `Placeholder result for: ${query}`,
        sourceUrl: undefined,
        license: 'N/A',
        attribution: undefined,
        altText: `Placeholder photo for ${query}`
      }
    ]
  });
});

assetsRouter.post('/fetch', async (req, res) => {
  // Placeholder: in a real implementation we would download, optimize, store.
  const sourceUrl = String(req.body?.sourceUrl ?? '').trim();
  if (!sourceUrl) return res.status(400).json({ success: false, error: 'Missing sourceUrl' });

  return res.json({ success: true, assetId: `fetched-${Date.now()}`, sourceUrl });
});
