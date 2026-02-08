import type { Slide } from '../types/deck.js';
import { runAgent } from './runAgent.js';
import { SlideEditResponseZ, SlidePatchZ } from './schemas.js';

/**
 * Patch-only slide editing agent.
 * Today: deterministic edits (no LLM) but uses the same contract.
 * Later: replace the body with an LLM call + structured output.
 */
export const SlideEditAgent = {
  async run(opts: {
    slideId: string;
    slide: Slide;
    instruction?: string;
    patch?: Partial<Slide>;
  }): Promise<{ slideId: string; patch: Partial<Slide>; warnings?: string[] }> {
    const warnings: string[] = [];
    const instruction = (opts.instruction ?? '').trim();

    // Start with explicit patch provided by UI.
    const outPatch: any = { ...(opts.patch ?? {}) };

    // Deterministic instruction handling (placeholder for real agent)
    if (instruction) {
      const low = instruction.toLowerCase();
      if (low.includes('short') || low.includes('shorter')) {
        if (Array.isArray(opts.slide.bullets) && opts.slide.bullets.length > 3) {
          outPatch.bullets = opts.slide.bullets.slice(0, 3);
          warnings.push('Trimmed bullets to 3 based on instruction.');
        }
      }
      if (low.includes('make it a quote')) {
        outPatch.slideType = 'quote';
        outPatch.quote = { text: opts.slide.title || 'Quote', attribution: undefined };
        outPatch.bullets = undefined;
        warnings.push('Converted slide to quote layout.');
      }
    }

    // Enforce patch schema: never allow id/order changes
    const patchParsed = SlidePatchZ.safeParse(outPatch);
    if (!patchParsed.success) {
      throw new Error('SlideEditAgent produced invalid patch');
    }

    const respRaw = {
      success: true,
      slideId: opts.slideId,
      patch: patchParsed.data,
      warnings: warnings.length ? warnings : undefined
    };

    const validated = await runAgent({
      name: 'SlideEditAgent',
      schema: SlideEditResponseZ,
      run: async () => respRaw
    });

    if (!validated.ok) throw new Error(validated.error);

    return {
      slideId: validated.value.slideId,
      patch: validated.value.patch,
      warnings: validated.value.warnings
    };
  }
};
