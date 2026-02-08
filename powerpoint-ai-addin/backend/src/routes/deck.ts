import { Router } from 'express';
import type { DeckGenerationRequest } from '../types/deck.js';
import { generateDeckWithAgents } from '../services/agentOrchestrator.js';
import { DeckStore } from '../services/deckStore.js';

export const deckRouter = Router();

deckRouter.post('/generate', async (req, res) => {
  const body = (req.body ?? {}) as Partial<DeckGenerationRequest>;
  const prompt = String(body.prompt ?? '').trim();
  if (!prompt) return res.status(400).json({ success: false, error: 'Missing prompt' });

  const result = await generateDeckWithAgents({
    prompt,
    slideCount: body.slideCount,
    theme: body.theme,
    includeSlideTypes: body.includeSlideTypes,
    targetAudience: body.targetAudience,
    tone: body.tone
  });

  if (result.success && result.deck) {
    DeckStore.set(result.deck);
  }

  return res.json(result);
});

// Patch-based single slide edit (Phase A)
deckRouter.post('/:deckId/slides/:slideId/edit', async (req, res) => {
  const deckId = String(req.params.deckId);
  const slideId = String(req.params.slideId);
  const instruction = String(req.body?.instruction ?? '').trim();
  const patch = (req.body?.patch ?? {}) as any;

  if (!instruction && (!patch || Object.keys(patch).length === 0)) {
    return res.status(400).json({ success: false, error: 'Missing instruction or patch' });
  }

  // Prototype behavior:
  // - If patch provided, apply it directly.
  // - If instruction provided, do a simple deterministic edit (later: real agent).
  const appliedPatch: any = { ...patch };
  if (instruction) {
    // Very basic: shorten bullets
    if (instruction.toLowerCase().includes('short')) {
      if (Array.isArray(appliedPatch.bullets)) {
        appliedPatch.bullets = appliedPatch.bullets.slice(0, 3);
      } else {
        // no bullets in patch; no-op
      }
    }
  }

  const updated = DeckStore.patchSlide(deckId, slideId, appliedPatch);
  if (!updated) return res.status(404).json({ success: false, error: 'Deck not found' });

  const slide = updated.slides.find((s) => s.id === slideId);
  if (!slide) return res.status(404).json({ success: false, error: 'Slide not found' });

  return res.json({ success: true, slideId, patch: appliedPatch, slide });
});
