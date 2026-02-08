import { Router } from 'express';
import { DeckStore } from '../services/deckStore.js';

export const speakerNotesRouter = Router();

// Regenerate speaker notes for the whole deck (LLM)
// POST /api/deck/:deckId/speaker-notes/generate
speakerNotesRouter.post('/:deckId/speaker-notes/generate', async (req, res) => {
  const deckId = String(req.params.deckId);
  const deck = DeckStore.get(deckId);
  if (!deck) return res.status(404).json({ success: false, error: 'Deck not found' });

  try {
    const { SpeakerNotesAgent } = await import('../agents/speakerNotesAgent.js');
    const out = await SpeakerNotesAgent.run(deck);

    const updatedSlides = deck.slides.map((s) => ({
      ...s,
      speakerNotes: out.bySlideId[s.id] ?? s.speakerNotes
    }));

    DeckStore.set({ ...deck, slides: updatedSlides, metadata: { ...deck.metadata, updatedAt: new Date().toISOString() } } as any);

    return res.json({ success: true, deckId, updatedSlideIds: Object.keys(out.bySlideId), warnings: out.warnings });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e?.message ?? String(e) });
  }
});

// Regenerate speaker notes for ONE slide
// POST /api/deck/:deckId/slides/:slideId/speaker-notes/generate
speakerNotesRouter.post('/:deckId/slides/:slideId/speaker-notes/generate', async (req, res) => {
  const deckId = String(req.params.deckId);
  const slideId = String(req.params.slideId);
  const deck = DeckStore.get(deckId);
  if (!deck) return res.status(404).json({ success: false, error: 'Deck not found' });

  const slide = deck.slides.find((s) => s.id === slideId);
  if (!slide) return res.status(404).json({ success: false, error: 'Slide not found' });

  try {
    const { SpeakerNotesAgent } = await import('../agents/speakerNotesAgent.js');
    // Reuse deck agent but only apply note for requested slide.
    const out = await SpeakerNotesAgent.run({ ...deck, slides: [slide] } as any);
    const note = out.bySlideId[slideId];
    if (!note) return res.status(500).json({ success: false, error: 'No speaker notes generated', warnings: out.warnings });

    const updatedSlides = deck.slides.map((s) => (s.id === slideId ? { ...s, speakerNotes: note } : s));
    DeckStore.set({ ...deck, slides: updatedSlides, metadata: { ...deck.metadata, updatedAt: new Date().toISOString() } } as any);

    return res.json({ success: true, deckId, slideId, speakerNotes: note, warnings: out.warnings });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e?.message ?? String(e) });
  }
});
