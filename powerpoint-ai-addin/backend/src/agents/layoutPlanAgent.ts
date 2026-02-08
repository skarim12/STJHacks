import type { DeckSchema, Slide, SlideLayoutPlan } from '../types/deck.js';
import { runAgent } from './runAgent.js';
import { z } from 'zod';
import { llmGenerate, extractFirstJsonObject } from '../services/llm.js';
import { SlideLayoutPlanZ } from './schemas.js';

const SLIDE_W = 13.333;
const SLIDE_H = 7.5;

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

function sanitizePlan(plan: SlideLayoutPlan): SlideLayoutPlan {
  const boxes = (plan.boxes ?? []).map((b) => {
    const x = clamp(Number(b.x), 0, SLIDE_W - 0.1);
    const y = clamp(Number(b.y), 0, SLIDE_H - 0.1);
    const w = clamp(Number(b.w), 0.1, SLIDE_W - x);
    const h = clamp(Number(b.h), 0.1, SLIDE_H - y);
    const fontSize = b.fontSize != null ? clamp(Number(b.fontSize), 10, 44) : undefined;

    return {
      ...b,
      x,
      y,
      w,
      h,
      fontSize,
      // normalize colors to #RRGGBB if possible; otherwise leave for fallback
      color: b.color,
      fill: b.fill,
      line: b.line
    };
  });

  return {
    version: '1.0',
    slideW: SLIDE_W,
    slideH: SLIDE_H,
    boxes
  };
}

export const LayoutPlanAgent = {
  /**
   * Generate a raw layout plan (exact x/y/w/h) for each slide.
   * The renderer/exporters will auto-fit by reducing font size if needed.
   */
  async run(deck: DeckSchema): Promise<{ bySlideId: Record<string, SlideLayoutPlan>; warnings: string[] }> {
    const warnings: string[] = [];

    const system = `You are a PowerPoint layout engine.
Return ONLY valid JSON (no markdown).

You are given a deck theme and slide content.
You must output for EACH slide a layout plan in inches for a 16:9 wide slide.
Slide size:
- slideW = 13.333
- slideH = 7.5

Rules:
- Output EXACT x,y,w,h for each box.
- Keep all boxes within slide bounds.
- Use safe margins (~0.5in).
- Prefer visually appealing, varied layouts.
- If slide has an image asset, include an 'image' box.
- Include at least: title box; and either bullets/body; optional shapes/cards for style.
- Use kind: title|subtitle|bullets|body|image|shape.

JSON schema:
{
  "plans": [
    {
      "slideId": "...",
      "plan": {
        "version": "1.0",
        "slideW": 13.333,
        "slideH": 7.5,
        "boxes": [
          {
            "id": "title",
            "kind": "title",
            "x": 0.5,
            "y": 0.4,
            "w": 12.3,
            "h": 0.8,
            "fontFace": "...",
            "fontSize": 34,
            "color": "#RRGGBB",
            "bold": true,
            "align": "left",
            "valign": "top"
          }
        ]
      }
    }
  ]
}`.trim();

    const slides = deck.slides ?? [];

    // Provide a compact content summary to keep tokens bounded.
    const slideSummaries = slides.map((s) => ({
      slideId: s.id,
      slideType: s.slideType,
      title: s.title,
      subtitle: s.subtitle ?? null,
      bullets: (s.bullets ?? []).slice(0, 7),
      bodyText: s.bodyText ?? null,
      hasPhoto: Boolean(s.selectedAssets?.some((a) => a.kind === 'photo' && a.dataUri)),
      theme: {
        fontHeading: deck.theme.fontHeading,
        fontBody: deck.theme.fontBody,
        backgroundColor: deck.theme.backgroundColor,
        textColor: deck.theme.textColor,
        accentColor: deck.theme.accentColor,
        primaryColor: deck.theme.primaryColor,
        secondaryColor: deck.theme.secondaryColor
      },
      decoration: deck.decoration ?? null
    }));

    const user = `Generate varied layout plans for these slides:
${JSON.stringify(slideSummaries)}
`.trim();

    try {
      const { raw } = await llmGenerate({ system, user, maxTokens: 2200, temperature: 0.3 });
      const json = extractFirstJsonObject(raw);
      const plansArr = Array.isArray(json?.plans) ? json.plans : [];

      const bySlideId: Record<string, SlideLayoutPlan> = {};
      for (const p of plansArr) {
        const slideId = String(p?.slideId || '').trim();
        if (!slideId) continue;
        const plan = p?.plan as any;
        const validated = await runAgent({ name: 'LayoutPlanAgent.plan', schema: SlideLayoutPlanZ, run: async () => plan });
        if (!validated.ok) {
          warnings.push(`Layout plan invalid for slide ${slideId}: ${validated.error}`);
          continue;
        }
        bySlideId[slideId] = sanitizePlan(validated.value as any);
      }

      return { bySlideId, warnings };
    } catch (e: any) {
      warnings.push(`LayoutPlanAgent failed: ${e?.message ?? String(e)}`);
      return { bySlideId: {}, warnings };
    }
  }
};
