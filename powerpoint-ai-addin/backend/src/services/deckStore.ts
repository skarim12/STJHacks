import type { DeckSchema, Slide } from '../types/deck.js';

// In-memory store for the prototype.
// Replace with DB (or file storage) later.
const decks = new Map<string, DeckSchema>();

export const DeckStore = {
  get(deckId: string): DeckSchema | undefined {
    return decks.get(deckId);
  },

  set(deck: DeckSchema): void {
    decks.set(deck.id, deck);
  },

  patchSlide(deckId: string, slideId: string, patch: Partial<Slide>): DeckSchema | undefined {
    const deck = decks.get(deckId);
    if (!deck) return undefined;

    const slides = deck.slides.map((s) => (s.id === slideId ? { ...s, ...patch, id: s.id, order: s.order } : s));
    const updated: DeckSchema = {
      ...deck,
      slides,
      metadata: { ...deck.metadata, updatedAt: new Date().toISOString() }
    };
    decks.set(deckId, updated);
    return updated;
  }
};
