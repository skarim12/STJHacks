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
  if (type === "imagePlaceholder") {
    const veryShort = bullets.count <= 3 && bullets.totalLen <= 240 && bullets.maxLen <= 95;
    if (veryShort) return "image.fullBleed";
    return bullets.count > 4 ? "image.captionRight" : "image.hero";
  }

  // content
  const veryShort = bullets.count <= 3 && bullets.totalLen <= 240 && bullets.maxLen <= 95;
  const moderate = bullets.count <= 6 && bullets.totalLen <= 520 && bullets.maxLen <= 135;
  const hasEnoughForTwoCol = bullets.count >= 6 && bullets.totalLen <= 720 && bullets.maxLen <= 125;

  // Statement layout when the slide is basically one big idea.
  if (veryShort && bullets.count <= 2) return "content.statement";

  // Two column bullets for medium density lists.
  if (hasEnoughForTwoCol) return "content.twoColBullets";

  // Prefer a split layout for moderately light content so the slide has a dedicated image area.
  // Even if an image isn't available yet, we'll fill it in a later pass.
  if (moderate && bullets.count <= 5 && bullets.totalLen <= 420 && bullets.maxLen < 110) return "content.splitRightHero";

  if (hasImage) {
    return "content.singleCard";
  }

  // Accent bar gives some motion to otherwise plain content.
  if (moderate) return "content.leftAccentBar";

  return "content.singleCard";
}

function simpleHash(s: string): string {
  // Deterministic, cheap. (Not crypto.)
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
}

function validateAndRepairVariant(opts: {
  slideType: "title" | "content" | "comparison" | "quote" | "imagePlaceholder";
  hasImage: boolean;
  stats: { count: number; maxLen: number; totalLen: number };
  chosen: string;
}): string {
  const { slideType, hasImage, stats } = opts;

  // If a variant has an image box but we don't have an image *yet*, we still allow it.
  // The renderer will show a placeholder, and a later enrichment pass can fill it.
  // (This supports the "every slide with space gets an image" requirement.)

  // Text-heavy guardrails.
  const heavy = stats.count >= 7 || stats.totalLen >= 520 || stats.maxLen >= 140;
  if (heavy) {
    if (slideType === "content") return "content.singleCard";
    if (slideType === "imagePlaceholder") return "image.captionRight";
    if (slideType === "quote") return "quote.full";
  }

  // Variant-specific sanity.
  if (opts.chosen === "content.twoColBullets" && stats.count < 5) return "content.singleCard";
  if (opts.chosen === "content.statement" && stats.count > 4) return "content.singleCard";

  // Keep chosen if it exists and is allowed elsewhere.
  return opts.chosen;
}

export async function enrichOutlineWithLayouts(outline: any, opts: LayoutEnrichmentOptions) {
  const slides: any[] = Array.isArray(outline?.slides) ? outline.slides : [];
  const deckTitle = String(outline?.title || "").slice(0, 80);

  // Always-on: every slide gets a layout plan.
  let fullBleedUsed = 0;
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
User describe (if any): ${String(s.describe || outline?.describe || "").slice(0, 220)}
First bullets:
${(Array.isArray(s.content) ? s.content : []).slice(0, 4).map((b: any) => `- ${String(b).slice(0, 140)}`).join("\n")}
`;

    const title = String(s.title || "");
    const describe = String(s.describe || "");
    const bulletsPreview = (Array.isArray(s.content) ? s.content : []).slice(0, 4).map((b: any) => String(b ?? "")).join("\n");
    const contentSig = simpleHash(`${slideType}|${title}|${describe}|${bulletsPreview}`);

    // Include a content signature so caching doesn't wrongly conflate unrelated slides.
    const cacheKey = `layout:${deckTitle}:${i}:${slideType}:${hasImage ? 1 : 0}:${stats.count}:${stats.maxLen}:${Math.round(stats.totalLen / 50)}:${contentSig}`;

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

    // Deterministic repair pass: prevents broken layouts.
    chosen = validateAndRepairVariant({ slideType, hasImage, stats, chosen });

    // Limit full-bleed hero images to 1–3 per deck (recommended: 2).
    if (chosen === "image.fullBleed") {
      if (fullBleedUsed >= 2) chosen = "image.hero";
      else fullBleedUsed++;
    }

    // Ensure repaired choice is still allowed; else drop to heuristic.
    if (!variants.some((vv) => vv.name === chosen)) chosen = fallback;

    s.layoutPlan = { variant: chosen } satisfies LayoutPlan;
  }

  return outline as Outline;
}
