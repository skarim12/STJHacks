import type { Slide } from '../types/deck.js';
import { llmGenerate, extractFirstJsonObject } from '../services/llm.js';
import { runAgent } from './runAgent.js';
import { SlideEditResponseZ, SlidePatchZ } from './schemas.js';

const slideEditSystemPrompt = `You are a slide editor agent.
Return ONLY valid JSON (no markdown) representing a PATCH object to apply to the slide.
Constraints:
- Output must be a JSON object.
- Do NOT include or modify: id, order.
- Only change fields that are necessary.
- Keep titles/bullets concise and presentation-ready.

The patch must match this shape (partial of Slide):
{
  "slideType"?: "title"|"section"|"content"|"bullets"|"twoColumn"|"comparison"|"quote"|"blank",
  "layout"?: "full"|"left"|"right"|"centered"|"split",
  "title"?: string,
  "subtitle"?: string,
  "bullets"?: string[],
  "bodyText"?: string,
  "speakerNotes"?: string,
  "leftColumn"?: { "heading"?: string, "bullets"?: string[] },
  "rightColumn"?: { "heading"?: string, "bullets"?: string[] },
  "quote"?: { "text": string, "attribution"?: string }
}`;

function buildSlideEditUserPrompt(opts: { slide: Slide; instruction: string }) {
  return `Instruction: ${opts.instruction}

Current slide JSON:
${JSON.stringify(opts.slide, null, 2)}

Return the PATCH JSON now.`;
}

/**
 * Patch-only slide editing agent (LLM-backed).
 * Always uses an agent when possible; falls back to deterministic minimal edits if LLM fails.
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
    let outPatch: any = { ...(opts.patch ?? {}) };

    if (instruction) {
      // 1) LLM attempt(s)
      let llmPatch: any | null = null;
      let lastErr: string | null = null;

      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const user = buildSlideEditUserPrompt({
            slide: opts.slide,
            instruction:
              attempt === 0
                ? instruction
                : `${instruction}\n\nYour previous output was invalid JSON or violated constraints. Fix it and output ONLY the PATCH JSON object. Do not include id/order.`
          });

          const { raw, provider } = await llmGenerate({
            system: slideEditSystemPrompt,
            user,
            maxTokens: 900,
            temperature: 0.4
          });

          const json = extractFirstJsonObject(raw);
          // hard block id/order
          if (json && typeof json === 'object') {
            delete (json as any).id;
            delete (json as any).order;
          }

          const parsed = SlidePatchZ.safeParse(json);
          if (!parsed.success) {
            lastErr = parsed.error.message;
            continue;
          }

          llmPatch = parsed.data;
          warnings.push(`SlideEditAgent used provider: ${provider}`);
          break;
        } catch (e: any) {
          lastErr = e?.message ?? String(e);
        }
      }

      if (llmPatch) {
        outPatch = { ...outPatch, ...llmPatch };
      } else {
        warnings.push(`SlideEditAgent LLM failed; using fallback edits. ${lastErr ? `(${lastErr})` : ''}`);

        // 2) deterministic fallback (minimal)
        const low = instruction.toLowerCase();
        if ((low.includes('short') || low.includes('shorter')) && Array.isArray(opts.slide.bullets)) {
          outPatch.bullets = opts.slide.bullets.slice(0, Math.min(3, opts.slide.bullets.length));
        }
        if (low.includes('make it a quote')) {
          outPatch.slideType = 'quote';
          outPatch.quote = { text: opts.slide.title || 'Quote', attribution: undefined };
          outPatch.bullets = undefined;
        }
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
