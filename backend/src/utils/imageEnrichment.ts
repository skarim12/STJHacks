import { buildDefaultImageQuery, fetchSlideImageFromWikimedia } from "./externalImages";
import { generateSlideImageOpenAI } from "./imageGeneration";

export type ImageEnrichmentOptions = {
  allowExternalImages: boolean;
  allowGeneratedImages: boolean;
  // Enforce a coherent look across the whole deck.
  // - "photo": prefer photo-like sources
  // - "illustration": prefer illustration-like sources
  imageStyle?: "photo" | "illustration";
  maxDeckImages?: number;
  concurrency?: number;
};

export type EnrichmentReport = {
  imagesAdded: number;
  perSlide: Array<{ index: number; slideType: string; query: string; source: "wikimedia" | "openai" | "none" }>;
};

export async function enrichOutlineWithImages(outline: any, opts: ImageEnrichmentOptions): Promise<EnrichmentReport> {
  const allowExternalImages = !!opts.allowExternalImages;
  const allowGeneratedImages = !!opts.allowGeneratedImages;
  const maxDeckImages = opts.maxDeckImages ?? 10;
  const concurrency = opts.concurrency ?? 2;
  const imageStyle = opts.imageStyle ?? "photo";

  const slides: any[] = Array.isArray(outline?.slides) ? outline.slides : [];

  let used = 0;
  const report: EnrichmentReport = { imagesAdded: 0, perSlide: [] };

  if ((!allowExternalImages && !allowGeneratedImages) || slides.length === 0) {
    return report;
  }

  let idx = 0;
  const workers = new Array(concurrency).fill(0).map(async () => {
    while (idx < slides.length && used < maxDeckImages) {
      const i = idx++;
      const s = slides[i];
      if (!s) continue;
      const slideType = String(s.slideType || "").toLowerCase();
      if (slideType === "title") continue;
      if (s.imageDataUri) continue;

      // Strategy: always try for explicit image slides; else every other slide.
      const wantsImage = slideType === "image" || slideType === "imageplaceholder" || i % 2 === 1;
      if (!wantsImage) continue;

      const query = buildDefaultImageQuery({
        deckTitle: outline?.title,
        slideTitle: s?.title,
        bullets: Array.isArray(s?.content) ? s.content : [],
      });
      if (!query) continue;

      // 1) Wikimedia
      if (allowExternalImages) {
        try {
          const img = await fetchSlideImageFromWikimedia({ query });
          if (img?.dataUri) {
            s.imageDataUri = img.dataUri;
            s.imageCredit = img.credit;
            s.imageSourcePage = img.sourcePage;
            used++;
            report.imagesAdded++;
            report.perSlide.push({ index: i, slideType, query, source: "wikimedia" });
            continue;
          }
        } catch {
          // ignore
        }
      }

      // 2) AI image generation fallback
      if (allowGeneratedImages) {
        try {
          const gen = await generateSlideImageOpenAI({ prompt: query, style: imageStyle });
          if (gen?.dataUri) {
            s.imageDataUri = gen.dataUri;
            s.imageCredit = `AI-generated (${imageStyle})`;
            s.imageSourcePage = "";
            used++;
            report.imagesAdded++;
            report.perSlide.push({ index: i, slideType, query, source: "openai" });
            continue;
          }
        } catch {
          // ignore
        }
      }

      report.perSlide.push({ index: i, slideType, query, source: "none" });
    }
  });

  await Promise.all(workers);
  return report;
}
