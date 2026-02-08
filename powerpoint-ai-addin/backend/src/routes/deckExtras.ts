import { Router } from 'express';
import { DeckStore } from '../services/deckStore.js';
import { runDeckQa } from '../services/deckQa.js';

export const deckExtrasRouter = Router();

// GET /api/deck/:deckId
// Return the current in-memory deck
// (In production you'd persist; for prototype this is enough.)
deckExtrasRouter.get('/:deckId', (req, res) => {
  const deckId = String(req.params.deckId);
  const deck = DeckStore.get(deckId);
  if (!deck) return res.status(404).json({ success: false, error: 'Deck not found' });
  return res.json({ success: true, deck });
});

// POST /api/deck/:deckId/qa/run
deckExtrasRouter.post('/:deckId/qa/run', (req, res) => {
  const deckId = String(req.params.deckId);
  const deck = DeckStore.get(deckId);
  if (!deck) return res.status(404).json({ success: false, error: 'Deck not found' });
  const report = runDeckQa(deck);
  return res.json({ success: true, deckId, report });
});

// POST /api/deck/:deckId/improve
// Runs: content refine -> speaker notes fill -> layout regen
// Best-effort; always returns success with warnings unless deck missing.
deckExtrasRouter.post('/:deckId/improve', async (req, res) => {
  const deckId = String(req.params.deckId);
  const deck = DeckStore.get(deckId);
  if (!deck) return res.status(404).json({ success: false, error: 'Deck not found' });

  const warnings: string[] = [];
  let working: any = { ...deck };

  try {
    const { ContentRefinementAgent } = await import('../agents/contentRefinementAgent.js');
    const out = await ContentRefinementAgent.run(working);
    warnings.push(...out.warnings);

    if (out.patches?.length) {
      const byId: Record<string, any> = {};
      for (const p of out.patches) byId[String(p.slideId)] = p;
      working.slides = working.slides.map((s: any) => {
        const p = byId[s.id];
        if (!p) return s;
        return {
          ...s,
          title: p.title ?? s.title,
          bullets: p.bullets ?? s.bullets,
          bodyText: p.bodyText ?? s.bodyText,
          speakerNotes: p.speakerNotes ?? s.speakerNotes
        };
      });
    }
  } catch (e: any) {
    warnings.push(`Improve: content refine crashed: ${e?.message ?? String(e)}`);
  }

  try {
    const { SpeakerNotesAgent } = await import('../agents/speakerNotesAgent.js');
    const out = await SpeakerNotesAgent.run(working);
    warnings.push(...out.warnings);
    working.slides = working.slides.map((s: any) => ({ ...s, speakerNotes: out.bySlideId[s.id] ?? s.speakerNotes }));
  } catch (e: any) {
    warnings.push(`Improve: speaker notes crashed: ${e?.message ?? String(e)}`);
  }

  try {
    const { LayoutPlanAgent } = await import('../agents/layoutPlanAgent.js');
    const out = await LayoutPlanAgent.run(working);
    warnings.push(...out.warnings);
    for (const s of working.slides) {
      const p = out.bySlideId[s.id];
      if (p) s.layoutPlan = p;
    }
  } catch (e: any) {
    warnings.push(`Improve: layout plan crashed: ${e?.message ?? String(e)}`);
  }

  working.metadata = { ...(working.metadata ?? {}), updatedAt: new Date().toISOString() };
  DeckStore.set(working);

  const report = runDeckQa(working);
  return res.json({ success: true, deckId, report, warnings });
});
