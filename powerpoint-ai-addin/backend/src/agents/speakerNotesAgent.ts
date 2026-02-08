import type { DeckSchema } from '../types/deck.js';
import { runAgent } from './runAgent.js';
import { z } from 'zod';
import { llmGenerate, extractFirstJsonObject } from '../services/llm.js';

const SpeakerNotesOutZ = z.object({
  notes: z.array(
    z.object({
      slideId: z.string(),
      speakerNotes: z.string().min(10)
    })
  )
});

export const SpeakerNotesAgent = {
  async run(deck: DeckSchema): Promise<{ bySlideId: Record<string, string>; warnings: string[] }> {
    const warnings: string[] = [];

    const system = `You are a presentation speaking coach.
Return ONLY valid JSON.

Write speaker notes that are:
- 2-5 sentences per slide
- explain the slide bullets clearly
- add smooth transitions and what to emphasize
- do not add new claims that contradict slide content

Schema:
{ "notes": [ { "slideId": string, "speakerNotes": string } ] }`;

    const slides = deck.slides.map((s) => ({
      slideId: s.id,
      title: s.title,
      subtitle: s.subtitle ?? null,
      bullets: s.bullets ?? [],
      bodyText: s.bodyText ?? null
    }));

    const user = `Deck title: ${deck.title}
Slides:
${JSON.stringify(slides)}
`;

    try {
      const { raw } = await llmGenerate({ system, user, maxTokens: 1600, temperature: 0.5 });
      const json = extractFirstJsonObject(raw);
      const validated = await runAgent({ name: 'SpeakerNotesAgent.out', schema: SpeakerNotesOutZ, run: async () => json });
      if (!validated.ok) throw new Error(validated.error);

      const bySlideId: Record<string, string> = {};
      for (const n of validated.value.notes) {
        bySlideId[n.slideId] = n.speakerNotes;
      }
      return { bySlideId, warnings };
    } catch (e: any) {
      warnings.push(`SpeakerNotesAgent failed: ${e?.message ?? String(e)}`);
      return { bySlideId: {}, warnings };
    }
  }
};
