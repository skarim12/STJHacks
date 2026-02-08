import type { StylePreset } from '../types/deck.js';

const hasAnthropic = () => Boolean(String(process.env.CLAUDE_API_KEY ?? '').trim());
const hasOpenAI = () => Boolean(String(process.env.API_KEY ?? '').trim());

export type LlmProvider = 'anthropic' | 'openai';

export const pickProvider = (): LlmProvider => {
  if (hasAnthropic()) return 'anthropic';
  if (hasOpenAI()) return 'openai';
  throw new Error('No LLM API key found. Set CLAUDE_API_KEY (Anthropic) or API_KEY (OpenAI).');
};

export type LlmCall = {
  system: string;
  user: string;
  maxTokens?: number;
  temperature?: number;
};

const styleSystemPrompt = `You are a design system generator for presentation decks.
Return ONLY valid JSON (no markdown) matching this TypeScript shape:
{
  "id": string,
  "name": string,
  "theme": {
    "primaryColor": string, "secondaryColor": string, "accentColor": string,
    "backgroundColor": string, "textColor": string,
    "fontHeading": string, "fontBody": string,
    "fontSize": "small"|"medium"|"large"
  },
  "decoration": {
    "backgroundStyle": "solid"|"softGradient"|"boldGradient",
    "cornerBlobs": boolean,
    "headerStripe": boolean,
    "cardStyle": "flat"|"softShadow",
    "imageTreatment": "square"|"rounded",
    "gradientCss": string
  }
}

Color values must be HSL triplets like "220 70% 50%" (NO hsl() wrapper). 
"gradientCss" must be a CSS linear-gradient(...) string using hsl(...) with those triplets.
Make it aesthetically cohesive and readable (good contrast).`;

const userPrompt = (opts: {
  deckTitle: string;
  deckPrompt: string;
  designPrompt: string;
  tone?: string;
  audience?: string;
}) => {
  return `Deck title: ${opts.deckTitle}
Deck prompt: ${opts.deckPrompt}
Design prompt: ${opts.designPrompt}
Tone: ${opts.tone ?? 'unspecified'}
Audience: ${opts.audience ?? 'unspecified'}

Generate a single style preset.`;
};

async function anthropicGenerate(call: LlmCall): Promise<string> {
  const key = String(process.env.CLAUDE_API_KEY ?? '').trim();
  // Default to a widely-available Sonnet model; can be overridden via CLAUDE_MODEL.
  const model = String(process.env.CLAUDE_MODEL ?? 'claude-3-5-sonnet-20241022');

  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model,
      max_tokens: call.maxTokens ?? 900,
      temperature: call.temperature ?? 0.6,
      system: call.system,
      messages: [{ role: 'user', content: call.user }]
    })
  });

  if (!r.ok) {
    const t = await r.text().catch(() => '');
    throw new Error(`Anthropic error ${r.status}: ${t.slice(0, 300)}`);
  }

  const data: any = await r.json();
  const text = data?.content?.find((c: any) => c?.type === 'text')?.text;
  if (!text) throw new Error('Anthropic response missing text');
  return text;
}

async function openaiGenerate(call: LlmCall): Promise<string> {
  const key = String(process.env.API_KEY ?? '').trim();
  const model = String(process.env.OPENAI_MODEL ?? 'gpt-4o-mini');

  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${key}`
    },
    body: JSON.stringify({
      model,
      temperature: call.temperature ?? 0.6,
      messages: [
        { role: 'system', content: call.system },
        { role: 'user', content: call.user }
      ]
    })
  });

  if (!r.ok) {
    const t = await r.text().catch(() => '');
    throw new Error(`OpenAI error ${r.status}: ${t.slice(0, 300)}`);
  }

  const data: any = await r.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error('OpenAI response missing content');
  return text;
}

export async function llmGenerate(call: LlmCall): Promise<{ raw: string; provider: LlmProvider }> {
  const provider = pickProvider();

  if (provider === 'anthropic') {
    const raw = await anthropicGenerate(call);
    return { raw, provider };
  }

  const raw = await openaiGenerate(call);
  return { raw, provider };
}

export async function generateStylePresetLLM(opts: {
  deckTitle: string;
  deckPrompt: string;
  designPrompt: string;
  tone?: string;
  audience?: string;
}): Promise<{ raw: string; provider: LlmProvider }> {
  const user = userPrompt(opts);
  return await llmGenerate({ system: styleSystemPrompt, user, maxTokens: 900, temperature: 0.6 });
}

export function extractFirstJsonObject(raw: string): any {
  // Try direct parse first
  try {
    return JSON.parse(raw);
  } catch {
    // Attempt to extract the first {...} block
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start >= 0 && end > start) {
      const slice = raw.slice(start, end + 1);
      return JSON.parse(slice);
    }
    throw new Error('Could not parse JSON from LLM output');
  }
}
