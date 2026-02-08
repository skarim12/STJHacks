export class StyleApiClient {
  constructor(private cfg: { baseUrl: string }) {}

  async generateStyle(req: {
    deckTitle: string;
    deckPrompt: string;
    designPrompt: string;
    tone?: string;
    audience?: string;
  }): Promise<any> {
    const r = await fetch(`${this.cfg.baseUrl}/api/style/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req)
    });
    return await r.json();
  }
}
