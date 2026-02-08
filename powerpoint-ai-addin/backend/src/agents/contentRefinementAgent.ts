import type { DeckSchema } from '../types/deck.js';
import { runAgent } from './runAgent.js';
import { z } from 'zod';
import { llmGenerate, extractFirstJsonObject } from '../services/llm.js';

const PatchOutZ = z.object({
  patches: z.array(
    z.object({
      slideId: z.string(),
      title: z.string().optional(),
      bullets: z.array(z.string()).optional(),
      bodyText: z.string().optional(),
      speakerNotes: z.string().optional()
    })
  )
});

export const ContentRefinementAgent = {
  async run(deck: DeckSchema): Promise<{ patches: Array<any>; warnings: string[] }> {
    const warnings: string[] = [];

    const system = `You are a senior deck editor.
Return ONLY valid JSON.

Goal: make the deck content more specific and professional.
Rules:
- Keep slide count and slideIds the same.
- Improve titles to be assertion-based.
- Bullets should be concrete (numbers/examples), not generic.
- Bullets per slide: vary (4-7 typically), not always 3.
- Speaker notes: 2-5 sentences, crisp, with transitions.

Schema:
{ "patches": [ { "slideId": string, "title"?: string, "bullets"?: string[], "bodyText"?: string, "speakerNotes"?: string } ] }`;

    const slides = deck.slides.map((s) => ({
      slideId: s.id,
      slideType: s.slideType,
      title: s.title,
      subtitle: s.subtitle ?? null,
      bullets: s.bullets ?? [],
      bodyText: s.bodyText ?? null,
      speakerNotes: s.speakerNotes ?? null
    }));

    const user = `Deck title: ${deck.title}
Audience: ${deck.metadata?.targetAudience ?? 'unspecified'}
Slides:
${JSON.stringify(slides)}
`;

    try {
      const { raw } = await llmGenerate({ system, user, maxTokens: 2200, temperature: 0.4 });
      const json = extractFirstJsonObject(raw);
      const validated = await runAgent({ name: 'ContentRefinementAgent.out', schema: PatchOutZ, run: async () => json });
      if (!validated.ok) throw new Error(validated.error);
      return { patches: validated.value.patches, warnings };
    } catch (e: any) {
      warnings.push(`ContentRefinementAgent failed: ${e?.message ?? String(e)}`);
      return { patches: [], warnings };
    }
  }
};
