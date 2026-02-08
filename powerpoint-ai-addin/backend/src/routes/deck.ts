import { Router } from 'express';
import type { DeckGenerationRequest } from '../types/deck.js';
import { generateDeckWithAgents } from '../services/agentOrchestrator.js';
import { DeckStore } from '../services/deckStore.js';
import { DeckGenerationRequestZ, SlideEditRequestZ } from '../agents/schemas.js';
import { SlideEditAgent } from '../agents/slideEditAgent.js';

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
