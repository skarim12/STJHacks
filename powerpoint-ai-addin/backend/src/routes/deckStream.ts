import { Router } from 'express';
import type { DeckGenerationRequest } from '../types/deck.js';
import { DeckGenerationRequestZ, SlideEditRequestZ } from '../agents/schemas.js';
import { generateDeckWithAgents } from '../services/agentOrchestrator.js';
import { DeckStore } from '../services/deckStore.js';
import { SlideEditAgent } from '../agents/slideEditAgent.js';
import { LayoutPlanAgent } from '../agents/layoutPlanAgent.js';

export const deckStreamRouter = Router();

function sse(res: any) {
  res.status(200);
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const send = (event: string, data: any) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  return { send };
}

// SSE: POST /api/deck/generate/stream
// Streams per-stage artifacts via orchestrator reporter.
deckStreamRouter.post('/generate/stream', async (req, res) => {
  const parsed = DeckGenerationRequestZ.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: 'Invalid request', issues: parsed.error.issues });
  }

  const { send } = sse(res);
  const body = parsed.data as DeckGenerationRequest;

  const reporter = {
    stageStart: (stage: any, meta?: any) => send('stage:start', { stage, ...meta }),
    artifact: (stage: any, name: string, data: any) => send('artifact', { stage, name, data }),
    warning: (stage: any, message: string, data?: any) => send('warning', { stage, message, data }),
    stageEnd: (stage: any, meta?: any) => send('stage:end', { stage, ...meta })
  };

  try {
    send('stage:start', { stage: 'generate', attempt: 1 });
    const result = await generateDeckWithAgents(body, reporter as any);

    if (result.success && result.deck) {
      DeckStore.set(result.deck);
      send('done', { deckId: result.deck.id, qa: (result as any).qa ?? null, warnings: result.warnings ?? [] });
    } else {
      send('error', { stage: 'generate', message: result.error ?? 'Deck generation failed', degraded: false });
    }
  } catch (e: any) {
    send('error', { stage: 'generate', message: e?.message ?? String(e), degraded: false });
  } finally {
    res.end();
  }
});

// SSE: POST /api/deck/:deckId/slides/:slideId/ai-edit/stream
// Streams slide edit progress and patch artifacts.
deckStreamRouter.post('/:deckId/slides/:slideId/ai-edit/stream', async (req, res) => {
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

  const { send } = sse(res);

  try {
    // Emit "before" artifact for diffing on the client.
    send('stage:start', { stage: 'slide_edit', deckId, slideId });
    send('artifact', { stage: 'slide_edit', name: 'before', data: slide });

    // Pass 1: draft patch (currently same agent output; reserved for future multi-pass refinement)
    send('stage:start', { stage: 'slide_edit_draft', deckId, slideId });
    const out = await SlideEditAgent.run({
      slideId,
      slide,
      instruction: parsed.data.instruction,
      patch: parsed.data.patch as any
    });
    send('artifact', { stage: 'slide_edit', name: 'draft_patch', data: out.patch });
    send('stage:end', { stage: 'slide_edit_draft', deckId, slideId });

    if (out.warnings?.length) {
      send('warning', { stage: 'slide_edit', message: 'SlideEditAgent warnings', data: { warnings: out.warnings } });
    }

    // Apply patch
    const updatedDeck = DeckStore.patchSlide(deckId, slideId, out.patch as any);
    if (!updatedDeck) {
      send('error', { stage: 'slide_edit', message: 'Deck not found after update', degraded: false });
      return res.end();
    }

    // Pass 2: re-run layout for this slide (best-effort) so preview + PPT insertion stay consistent.
    let layoutPatched = false;
    try {
      send('stage:start', { stage: 'layout_single', deckId, slideId });
      const { bySlideId, warnings } = await LayoutPlanAgent.run(updatedDeck as any);
      const lp = (bySlideId as any)?.[slideId];
      if (lp) {
        DeckStore.patchSlide(deckId, slideId, { layoutPlan: lp } as any);
        layoutPatched = true;
        send('artifact', { stage: 'layout_single', name: 'layoutPlan', data: lp });
      }
      if (warnings?.length) {
        send('warning', { stage: 'layout_single', message: 'LayoutPlanAgent warnings', data: { warnings } });
      }
      send('stage:end', { stage: 'layout_single', deckId, slideId, layoutPatched });
    } catch (e: any) {
      send('warning', { stage: 'layout_single', message: 'LayoutPlanAgent crashed', data: { error: e?.message ?? String(e) } });
    }

    const afterDeck = DeckStore.get(deckId);
    const afterSlide = afterDeck?.slides?.find((s) => s.id === slideId) ?? null;
    send('artifact', { stage: 'slide_edit', name: 'after', data: afterSlide });

    send('stage:end', { stage: 'slide_edit', deckId, slideId, layoutPatched });
    send('done', { deckId, slideId, patch: out.patch, layoutPatched, warnings: out.warnings ?? [] });
  } catch (e: any) {
    send('error', { stage: 'slide_edit', message: e?.message ?? String(e), degraded: false });
  } finally {
    res.end();
  }
});
