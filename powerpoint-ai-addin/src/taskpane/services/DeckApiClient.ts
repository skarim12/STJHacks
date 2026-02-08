import type { DeckGenerationResponse, Slide } from '../types';

export class DeckApiClient {
  constructor(private cfg: { baseUrl: string }) {}

  async generateDeck(req: {
    prompt: string;
    designPrompt?: string;
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

  async autoPickVisual(deckId: string, slideId: string, opts?: { query?: string; prompt?: string }): Promise<any> {
    const r = await fetch(`${this.cfg.baseUrl}/api/deck/${deckId}/slides/${slideId}/visuals/auto`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: opts?.query, prompt: opts?.prompt })
    });
    return await r.json();
  }

  async generateAiImage(opts: { prompt: string; size?: string }): Promise<any> {
    const r = await fetch(`${this.cfg.baseUrl}/api/assets/generate-image`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(opts)
    });
    return await r.json();
  }

  async downloadPptx(deckId: string): Promise<Blob> {
    const r = await fetch(`${this.cfg.baseUrl}/api/export/pptx/${encodeURIComponent(deckId)}`);
    if (!r.ok) {
      const t = await r.text().catch(() => '');
      throw new Error(`PPTX export failed: ${r.status} ${t.slice(0, 200)}`);
    }
    return await r.blob();
  }
}

