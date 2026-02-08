import type { DeckGenerationRequest, Slide, ThemeTokens } from '../types/deck.js';
import { newId } from '../utils/id.js';
import { runAgent } from './runAgent.js';
import { z } from 'zod';
import { SlideZ } from './schemas.js';

const titleFromPrompt = (prompt: string): string => {
  const words = prompt.trim().split(/\s+/).slice(0, 7);
  if (!words.length) return 'Untitled Deck';
  return words.join(' ') + (prompt.trim().split(/\s+/).length > 7 ? '…' : '');
};

const clampBullets = (bullets: string[] | undefined, max = 6): string[] | undefined => {
  if (!bullets?.length) return bullets;
  return bullets.slice(0, max);
};

export const OutlineAgent = {
  async run(req: DeckGenerationRequest): Promise<{ title: string; slides: Slide[] }> {
    const slideCount = Math.max(3, Math.min(15, req.slideCount ?? 5));

    const slides: Slide[] = [];

    slides.push({
      id: newId('slide'),
      order: 0,
      slideType: 'title',
      layout: 'centered',
      title: titleFromPrompt(req.prompt),
      subtitle: req.targetAudience ? `For ${req.targetAudience}` : 'Generated outline',
      speakerNotes: 'Set context and state the goal of the presentation.'
    });

    const middleCount = slideCount - 2;
    const topics = ['Problem / Opportunity', 'Solution Overview', 'How It Works', 'Impact / Metrics', 'Next Steps'].slice(
      0,
      middleCount
    );

    topics.forEach((t, i) => {
      slides.push({
        id: newId('slide'),
        order: i + 1,
        slideType: 'bullets',
        layout: 'full',
        title: t,
        bullets: clampBullets([
          `Key point about ${t.toLowerCase()}`,
          'Supporting detail / evidence',
          'Risks / constraints (if any)'
        ]),
        speakerNotes: `Explain ${t.toLowerCase()} and connect it back to the objective.`
      });
    });

    slides.push({
      id: newId('slide'),
      order: slideCount - 1,
      slideType: 'section',
      layout: 'centered',
      title: 'Key Takeaways',
      bullets: clampBullets(['What we learned', 'What we’re proposing', 'What happens next']),
      speakerNotes: 'Summarize and clearly ask for a decision or action.'
    });

    // Validate each slide structure (agent contract)
    const results = await Promise.all(
      slides.map((s) =>
        runAgent({
          name: 'OutlineAgent.slide',
          schema: SlideZ,
          run: async () => s
        })
      )
    );

    const bad = results.find((r) => !r.ok);
    if (bad && !bad.ok) throw new Error(bad.error);

    return { title: titleFromPrompt(req.prompt), slides };
  }
};
