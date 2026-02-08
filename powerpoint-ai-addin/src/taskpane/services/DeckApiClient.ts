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

  async getDeck(deckId: string): Promise<any> {
    const r = await fetch(`${this.cfg.baseUrl}/api/deck/${encodeURIComponent(deckId)}`);
    return await r.json();
  }

  async aiEditSlideStream(
    deckId: string,
    slideId: string,
    req: { instruction: string; patch?: any },
    onEvent: (evt: { event: string; data: any }) => void
  ): Promise<void> {
    return await this.postSse(
      `/api/deck/${encodeURIComponent(deckId)}/slides/${encodeURIComponent(slideId)}/ai-edit/stream`,
      req,
      onEvent
    );
  }

  private async postSse(path: string, body: any, onEvent: (evt: { event: string; data: any }) => void): Promise<void> {
    const r = await fetch(`${this.cfg.baseUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!r.ok || !r.body) {
      const t = await r.text().catch(() => '');
      throw new Error(`Stream failed: ${r.status} ${t.slice(0, 200)}`);
    }

    const reader = r.body.getReader();
    const dec = new TextDecoder('utf-8');
    let buf = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });

      while (true) {
        const idx = buf.indexOf('\n\n');
        if (idx < 0) break;
        const frame = buf.slice(0, idx);
        buf = buf.slice(idx + 2);

        let event = 'message';
        let dataStr = '';
        for (const line of frame.split(/\n/)) {
          if (line.startsWith('event:')) event = line.slice(6).trim();
          if (line.startsWith('data:')) dataStr += line.slice(5).trim();
        }

        if (!dataStr) continue;
        let data: any = null;
        try {
          data = JSON.parse(dataStr);
        } catch {
          data = dataStr;
        }

        onEvent({ event, data });
      }
    }
  }

  async generateDeckStream(
    req: {
      prompt: string;
      designPrompt?: string;
      slideCount?: number;
      targetAudience?: string;
      tone?: 'formal' | 'casual' | 'technical' | 'creative';
    },
    onEvent: (evt: { event: string; data: any }) => void
  ): Promise<void> {
    return await this.postSse('/api/deck/generate/stream', req, onEvent);
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

  async runQa(deckId: string): Promise<any> {
    const r = await fetch(`${this.cfg.baseUrl}/api/deck/${encodeURIComponent(deckId)}/qa/run`, { method: 'POST' });
    return await r.json();
  }

  async improveDeck(deckId: string): Promise<any> {
    const r = await fetch(`${this.cfg.baseUrl}/api/deck/${encodeURIComponent(deckId)}/improve`, { method: 'POST' });
    return await r.json();
  }

  async generateSpeakerNotesForDeck(deckId: string): Promise<any> {
    const r = await fetch(`${this.cfg.baseUrl}/api/deck/${encodeURIComponent(deckId)}/speaker-notes/generate`, {
      method: 'POST'
    });
    return await r.json();
  }

  async generateSpeakerNotesForSlide(deckId: string, slideId: string): Promise<any> {
    const r = await fetch(
      `${this.cfg.baseUrl}/api/deck/${encodeURIComponent(deckId)}/slides/${encodeURIComponent(slideId)}/speaker-notes/generate`,
      { method: 'POST' }
    );
    return await r.json();
  }

  async uploadPptx(file: File): Promise<any> {
    const fd = new FormData();
    fd.append('file', file);
    const r = await fetch(`${this.cfg.baseUrl}/api/upload/pptx`, {
      method: 'POST',
      body: fd
    });
    return await r.json();
  }
}

