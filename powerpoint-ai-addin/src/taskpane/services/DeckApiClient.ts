import type { DeckGenerationResponse, Slide } from '../types';

export class DeckApiClient {
  constructor(private cfg: { baseUrl: string }) {}

  async generateDeck(req: {
    prompt: string;
    slideCount?: number;
    targetAudience?: string;
    tone?: 'formal' | 'casual' | 'technical' | 'creative';
  }): Promise<DeckGenerationResponse> {
    const r = await fetch(`${this.cfg.baseUrl}/api/deck/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req)
    });
    return (await r.json()) as DeckGenerationResponse;
  }

  async searchPhotos(query: string, count = 6): Promise<any> {
    const r = await fetch(`${this.cfg.baseUrl}/api/assets/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, kind: 'photo', count })
    });
    return await r.json();
  }

  async fetchPhoto(sel: {
    downloadUrl: string;
    altText: string;
    attribution?: string;
    license?: string;
  }): Promise<any> {
    const r = await fetch(`${this.cfg.baseUrl}/api/assets/fetch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sel)
    });
    return await r.json();
  }

  async aiEditSlide(deckId: string, slideId: string, opts: { instruction: string }): Promise<any> {
    const r = await fetch(`${this.cfg.baseUrl}/api/deck/${deckId}/slides/${slideId}/ai-edit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ instruction: opts.instruction })
    });
    return await r.json();
  }
}
