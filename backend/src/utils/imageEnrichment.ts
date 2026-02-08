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

  // Optional: only attempt these slide indices (0-based). When provided, all other slides are skipped.
  onlySlideIndices?: number[];
};

export type EnrichmentReport = {
  imagesAdded: number;
  imagesBefore: number;
  imagesAfter: number;
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

  const only = Array.isArray(opts.onlySlideIndices)
    ? new Set(opts.onlySlideIndices.filter((n) => Number.isFinite(n)).map((n) => Number(n)))
    : null;
  const imageStyle = opts.imageStyle ?? "photo";

  const slides: any[] = Array.isArray(outline?.slides) ? outline.slides : [];

  let used = 0;
  const imagesBefore = slides.filter((s) => typeof (s as any)?.imageDataUri === "string" && String((s as any).imageDataUri).startsWith("data:image/")).length;

  const report: EnrichmentReport = {
    imagesAdded: 0,
    imagesBefore,
    imagesAfter: imagesBefore,
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

      if (only && !only.has(i)) {
        report.skipped.notSelected++;
        continue;
      }
      const slideType = String(s.slideType || "").toLowerCase();
      if (slideType === "title") {
        report.skipped.title++;
        continue;
      }
      if (s.imageDataUri) {
        report.skipped.alreadyHasImage++;
        continue;
      }

      // Strategy (user request): try to put an image on every slide that isn't the title.
      // Keep maxDeckImages as the controlling cap.
      report.attempted++;

      const bulletsArr = Array.isArray(s?.content) ? s.content : [];

      const query = buildDefaultImageQuery({
        deckTitle: outline?.title,
        deckDescribe: outline?.describe,
        slideTitle: s?.title,
        slideDescribe: s?.describe,
        bullets: bulletsArr,
      });
      if (!query) {
        report.skipped.noQuery++;
        report.perSlide.push({ index: i, slideType, query: "", source: "none", error: "no query" });
        continue;
      }

      const errors: string[] = [];

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
            report.imagesAfter = report.imagesBefore + report.imagesAdded;
            report.perSlide.push({ index: i, slideType, query, source: "wikimedia" });
            continue;
          }
          errors.push("wikimedia: no result");
        } catch (e: any) {
          errors.push(`wikimedia: ${String(e?.message || e)}`);
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
            report.imagesAfter = report.imagesBefore + report.imagesAdded;
            report.perSlide.push({ index: i, slideType, query, source: "wikipedia" });
            continue;
          }
          errors.push("wikipedia: no result");
        } catch (e: any) {
          errors.push(`wikipedia: ${String(e?.message || e)}`);
        }
      }

      // 2) AI image generation fallback
      if (allowGeneratedImages) {
        // Use a more slide-specific prompt than the Wikimedia query.
        const genPromptParts = [
          `Deck: ${String(outline?.title || "").trim()}`,
          `Slide: ${String(s?.title || "").trim()}`,
          String(s?.describe || "").trim() ? `Context: ${String(s?.describe).trim()}` : "",
          bulletsArr.length ? `Key points: ${bulletsArr.slice(0, 4).join("; ")}` : "",
        ].filter(Boolean);

        const genPrompt = genPromptParts.join("\n");

        try {
          const gen = await generateSlideImageOpenAI({ prompt: genPrompt, style: imageStyle });
          if (gen?.dataUri) {
            s.imageDataUri = gen.dataUri;
            s.imageCredit = `AI-generated (${imageStyle})`;
            s.imageSourcePage = "";
            used++;
            report.imagesAdded++;
            report.imagesAfter = report.imagesBefore + report.imagesAdded;
            report.perSlide.push({ index: i, slideType, query: genPrompt, source: "openai" });
            continue;
          }
          errors.push("openai: no result");
        } catch (e: any) {
          errors.push(`openai: ${String(e?.message || e)}`);
        }
      }

      const finalError =
        errors.length > 0
          ? errors.slice(0, 3).join(" | ")
          : !allowExternalImages && !allowGeneratedImages
            ? "images disabled"
            : allowExternalImages && !allowGeneratedImages
              ? "no image found (enable AI-generated fallback)"
              : "no image found";

      report.perSlide.push({ index: i, slideType, query, source: "none", error: finalError });
    }
  });

  await Promise.all(workers);
  return report;
}
