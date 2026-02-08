import { Router } from 'express';
import type { DeckGenerationRequest, SelectedAsset } from '../types/deck.js';
import { generateDeckWithAgents } from '../services/agentOrchestrator.js';
import { DeckStore } from '../services/deckStore.js';
import { DeckGenerationRequestZ, SlideEditRequestZ } from '../agents/schemas.js';
import { SlideEditAgent } from '../agents/slideEditAgent.js';
import { pickBestPhoto, searchPexelsPhotos } from '../services/pexels.js';
import { fetchImageAsDataUri } from '../services/assetFetch.js';

export const deckRouter = Router();

deckRouter.post('/generate', async (req, res) => {
  const parsed = DeckGenerationRequestZ.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: 'Invalid request', issues: parsed.error.issues });
  }

  const body = parsed.data as DeckGenerationRequest;

  const result = await generateDeckWithAgents(body);
  if (result.success && result.deck) {
    DeckStore.set(result.deck);
  }

  return res.json(result);
});

// Patch-based single slide edit (OpenClaw-style agent contract)
deckRouter.post('/:deckId/slides/:slideId/ai-edit', async (req, res) => {
  const deckId = String(req.params.deckId);
  const slideId = String(req.params.slideId);

  const deck = DeckStore.get(deckId);
  if (!deck) return res.status(404).json({ success: false, error: 'Deck not found' });

  const slide = deck.slides.find((s) => s.id === slideId);
  if (!slide) return res.status(404).json({ success: false, error: 'Slide not found' });

  const parsed = SlideEditRequestZ.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: 'Invalid request', issues: parsed.error.issues });
  }

  try {
    const out = await SlideEditAgent.run({
      slideId,
      slide,
      instruction: parsed.data.instruction,
      patch: parsed.data.patch as any
    });

    const updated = DeckStore.patchSlide(deckId, slideId, out.patch as any);
    if (!updated) return res.status(404).json({ success: false, error: 'Deck not found after update' });

    return res.json({ success: true, slideId, patch: out.patch, warnings: out.warnings });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e?.message ?? String(e) });
  }
});

// Auto-pick visuals for a slide (stock-first, AI fallback)
deckRouter.post('/:deckId/slides/:slideId/visuals/auto', async (req, res) => {
  const deckId = String(req.params.deckId);
  const slideId = String(req.params.slideId);

  const deck = DeckStore.get(deckId);
  if (!deck) return res.status(404).json({ success: false, error: 'Deck not found' });

  const slide = deck.slides.find((s) => s.id === slideId);
  if (!slide) return res.status(404).json({ success: false, error: 'Slide not found' });

  const intent = slide.visualIntent;
  const query =
    String(req.body?.query ?? '').trim() ||
    (intent?.queryTerms?.join(' ') || `${deck.title} ${slide.title}`).trim();

  const warnings: string[] = [];

  // 1) Try stock (Pexels)
  if (intent?.visualType === 'photo' || !intent) {
    try {
      const results = await searchPexelsPhotos(query, 6);
      const best = pickBestPhoto(results);
      if (best) {
        const fetched = await fetchImageAsDataUri(best.downloadUrl);
        const asset: SelectedAsset = {
          kind: 'photo',
          dataUri: fetched.dataUri,
          sourceUrl: best.sourceUrl ?? best.downloadUrl,
          attribution: best.attribution,
          license: best.license,
          altText: best.altText
        };

        const patch = {
          selectedAssets: [
            ...(slide.selectedAssets ?? []).filter((a) => a.kind !== 'photo'),
            asset
          ]
        };

        DeckStore.patchSlide(deckId, slideId, patch as any);
        return res.json({ success: true, slideId, source: 'stock', query, asset, warnings });
      }
      warnings.push('No suitable stock results; falling back to AI image generation.');
    } catch (e: any) {
      warnings.push(`Stock selection failed; falling back to AI: ${e?.message ?? String(e)}`);
    }
  }

  // 2) AI fallback (OpenAI Images)
  try {
    const { generateOpenAiImageBase64 } = await import('../services/openaiImages.js');
    const prompt =
      String(req.body?.prompt ?? '').trim() ||
      `High quality illustration or photo for a slide titled "${slide.title}". Goal: ${intent?.visualGoal ?? 'support the slide'}. Style: modern presentation, clean, high contrast.`;

    const out = await generateOpenAiImageBase64({ prompt, size: '1536x1024' });

    const asset: SelectedAsset = {
      kind: 'photo',
      dataUri: `data:image/png;base64,${out.b64}`,
      altText: prompt,
      attribution: 'AI-generated (OpenAI)',
      license: 'AI-generated'
    };

    const patch = {
      selectedAssets: [
        ...(slide.selectedAssets ?? []).filter((a) => a.kind !== 'photo'),
        asset
      ]
    };

    DeckStore.patchSlide(deckId, slideId, patch as any);
    return res.json({ success: true, slideId, source: 'ai', query, asset, warnings, revisedPrompt: out.revisedPrompt });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e?.message ?? String(e), warnings });
  }
});
