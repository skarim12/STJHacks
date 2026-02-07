import type { Outline } from "./deckHtml";
import { allowedVariantsForSlideType, getVariantByName } from "./layoutVariants";

export type LayoutPlan = { variant: string };

export type LayoutEnrichmentOptions = {
  // Anthropic JSON request function from routes/api.ts
  anthropicJsonRequest: (cacheKey: string, system: string, user: string, maxTokens?: number) => Promise<any>;
};

function normalizeSlideType(t: unknown): "title" | "content" | "comparison" | "quote" | "imagePlaceholder" {
  const s = String(t ?? "").toLowerCase().trim();
  if (s === "title") return "title";
  if (s === "comparison") return "comparison";
  if (s === "quote") return "quote";
  if (s === "image" || s === "imageplaceholder" || s === "image-placeholder") return "imagePlaceholder";
  return "content";
}

function bulletStats(content: unknown): { count: number; maxLen: number; totalLen: number } {
  const arr = Array.isArray(content) ? content : [];
  const texts = arr.map((x) => String(x ?? "").trim()).filter(Boolean);
  const lens = texts.map((t) => t.length);
  return {
    count: texts.length,
    maxLen: lens.length ? Math.max(...lens) : 0,
    totalLen: lens.reduce((a, b) => a + b, 0),
  };
}

function heuristicVariant(slideType: string, hasImage: boolean, bullets: { count: number; maxLen: number; totalLen: number }): string {
  const type = normalizeSlideType(slideType);
  if (type === "title") return "title.center";
  if (type === "comparison") return "comparison.twoCards";
  if (type === "quote") return hasImage ? "quote.splitImage" : "quote.full";
  if (type === "imagePlaceholder") return bullets.count > 4 ? "image.captionRight" : "image.hero";

  // content
  if (hasImage) {
    if (bullets.count <= 6 && bullets.maxLen < 110) return "content.splitRightHero";
    return "content.singleCard";
  }
  return "content.singleCard";
}

export async function enrichOutlineWithLayouts(outline: any, opts: LayoutEnrichmentOptions) {
  const slides: any[] = Array.isArray(outline?.slides) ? outline.slides : [];
  const deckTitle = String(outline?.title || "").slice(0, 80);

  // Always-on: every slide gets a layout plan.
  for (let i = 0; i < slides.length; i++) {
    const s = slides[i];
    if (!s) continue;

    const slideType = normalizeSlideType(s.slideType);
    const variants = allowedVariantsForSlideType(slideType);
    const hasImage = !!s.imageDataUri;
    const stats = bulletStats(s.content);

    const fallback = heuristicVariant(slideType, hasImage, stats);

    // Ask the AI to choose only from allowed variants.
    const system = `You are a layout planner for slides.

Return STRICT JSON only:
{"variant":"one of the allowed variants"}

Rules:
- You MUST choose a variant from the provided list.
- Prefer layouts that look dynamic (split layouts) when content is short and an image is available.
- If bullets are long or many, prefer the single card layout.
- No extra keys. No markdown.
`.trim();

    const user = `Deck title: ${deckTitle}
Slide #${i + 1}
Slide type: ${slideType}
Has image available: ${hasImage ? "yes" : "no"}
Bullet count: ${stats.count}
Max bullet length: ${stats.maxLen}

Allowed variants:
${variants.map((v) => `- ${v.name}`).join("\n")}

Slide title: ${String(s.title || "").slice(0, 120)}
First bullets:
${(Array.isArray(s.content) ? s.content : []).slice(0, 4).map((b: any) => `- ${String(b).slice(0, 140)}`).join("\n")}
`;

    const cacheKey = `layout:${deckTitle}:${i}:${slideType}:${hasImage ? 1 : 0}:${stats.count}:${stats.maxLen}`;

    let chosen = fallback;
    try {
      const json = await opts.anthropicJsonRequest(cacheKey, system, user, 256);
      const v = String((json as any)?.variant || "").trim();
      if (v && getVariantByName(v)) {
        // Ensure variant is allowed for this slide type
        if (variants.some((vv) => vv.name === v)) chosen = v;
      }
    } catch {
      // fallback
    }

    s.layoutPlan = { variant: chosen } satisfies LayoutPlan;
  }

  return outline as Outline;
}
