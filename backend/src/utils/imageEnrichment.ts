import { buildDefaultImageQuery, fetchSlideImageFromWikimedia, fetchSlideImageFromWikipedia } from "./externalImages";
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
  attempted: number;
  skipped: { title: number; alreadyHasImage: number; notSelected: number; noQuery: number };
  opts: { allowExternalImages: boolean; allowGeneratedImages: boolean; imageStyle: string; maxDeckImages: number };
  perSlide: Array<{
    index: number;
    slideType: string;
    query: string;
    source: "wikimedia" | "wikipedia" | "openai" | "none";
    error?: string;
  }>;
};

export async function enrichOutlineWithImages(outline: any, opts: ImageEnrichmentOptions): Promise<EnrichmentReport> {
  const allowExternalImages = !!opts.allowExternalImages;
  const allowGeneratedImages = !!opts.allowGeneratedImages;
  const maxDeckImages = opts.maxDeckImages ?? 10;
  const concurrency = opts.concurrency ?? 2;
  const imageStyle = opts.imageStyle ?? "photo";

  const slides: any[] = Array.isArray(outline?.slides) ? outline.slides : [];

  let used = 0;
  const report: EnrichmentReport = {
    imagesAdded: 0,
    attempted: 0,
    skipped: { title: 0, alreadyHasImage: 0, notSelected: 0, noQuery: 0 },
    opts: { allowExternalImages, allowGeneratedImages, imageStyle, maxDeckImages },
    perSlide: [],
  };

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
      if (slideType === "title") {
        report.skipped.title++;
        continue;
      }
      if (s.imageDataUri) {
        report.skipped.alreadyHasImage++;
        continue;
      }

      // Strategy: always try for explicit image slides; else every other slide.
      const wantsImage = slideType === "image" || slideType === "imageplaceholder" || i % 2 === 1;
      if (!wantsImage) {
        report.skipped.notSelected++;
        continue;
      }

      report.attempted++;

      const query = buildDefaultImageQuery({
        deckTitle: outline?.title,
        deckDescribe: outline?.describe,
        slideTitle: s?.title,
        slideDescribe: s?.describe,
        bullets: Array.isArray(s?.content) ? s.content : [],
      });
      if (!query) {
        report.skipped.noQuery++;
        report.perSlide.push({ index: i, slideType, query: "", source: "none", error: "no query" });
        continue;
      }

      let lastError: string | undefined;

      // 1) Wikimedia Commons file search
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
          lastError = lastError || "wikimedia: no result";
        } catch (e: any) {
          lastError = `wikimedia: ${String(e?.message || e)}`;
        }

        // 1b) Wikipedia page → lead image (much higher recall for abstract concepts)
        try {
          const img2 = await fetchSlideImageFromWikipedia({ query });
          if (img2?.dataUri) {
            s.imageDataUri = img2.dataUri;
            s.imageCredit = img2.credit;
            s.imageSourcePage = img2.sourcePage;
            used++;
            report.imagesAdded++;
            report.perSlide.push({ index: i, slideType, query, source: "wikipedia" });
            continue;
          }
          lastError = lastError || "wikipedia: no result";
        } catch (e: any) {
          lastError = lastError || `wikipedia: ${String(e?.message || e)}`;
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
          lastError = lastError || "openai: no result";
        } catch (e: any) {
          lastError = lastError || `openai: ${String(e?.message || e)}`;
        }
      }

      const finalError =
        lastError ||
        (!allowExternalImages && !allowGeneratedImages
          ? "images disabled"
          : allowExternalImages && !allowGeneratedImages
            ? "no image found (enable AI-generated fallback)"
            : "no image found");

      report.perSlide.push({ index: i, slideType, query, source: "none", error: finalError });
    }
  });

  await Promise.all(workers);
  return report;
}
