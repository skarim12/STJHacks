import { Router } from "express";
import axios from "axios";
import NodeCache from "node-cache";
import { config } from "../config/config";
import { buildPptxBuffer } from "../utils/pptx";
import multer from "multer";
import { extractTextFromPptxBuffer } from "../utils/pptxImport";
import { outlineToAiSlides, outlineToSimpleSlides, outlineToStyledSlides, wrapDeckHtml } from "../utils/deckHtml";
import { enrichOutlineWithImages } from "../utils/imageEnrichment";
import { enrichOutlineWithLayouts } from "../utils/layoutEnrichment";
import { enrichOutlineWithStyles } from "../utils/styleEnrichment";
import { renderHtmlToPdfBuffer } from "../utils/htmlToPdf";
import { enforceThemeStyle } from "../utils/themeStyle";
import { getVariantByName } from "../utils/layoutVariants";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 60 * 1024 * 1024, // 60MB
  },
});

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

// 5 minute TTL; avoids repeat calls for identical prompts
const cache = new NodeCache({ stdTTL: 300 });

function headers() {
  if (!config.claudeApiKey) throw new Error("CLAUDE_API_KEY not set");
  return {
    "x-api-key": config.claudeApiKey,
    "anthropic-version": "2023-06-01",
    "content-type": "application/json",
  };
}

async function anthropicJsonRequest(
  cacheKey: string,
  system: string,
  user: string,
  maxTokens?: number
) {
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  let response;
  try {
    response = await axios.post(
      ANTHROPIC_URL,
      {
        model: config.defaultModel,
        max_tokens: maxTokens ?? config.maxTokens,
        temperature: 0.2,
        system,
        messages: [{ role: "user", content: user }],
      },
      { headers: headers() }
    );
  } catch (err: any) {
    if (axios.isAxiosError(err)) {
      const status = err.response?.status;
      const data = err.response?.data;
      const hint =
        status === 404 && typeof (data as any)?.error?.message === "string" &&
        String((data as any).error.message).toLowerCase().includes("model")
          ? " (Hint: set a valid CLAUDE_MODEL in backend/.env, or use claude-3-5-sonnet-latest)"
          : "";
      throw new Error(
        `Anthropic request failed (status ${status}). Response: ${JSON.stringify(data)}${hint}`
      );
    }
    throw err;
  }

  const content = (response.data as any)?.content;
  if (!Array.isArray(content) || content.length === 0) {
    throw new Error("Unexpected Anthropic response (missing content array)");
  }

  const first = content[0];
  const rawText =
    typeof first === "object" && first && "text" in first ? (first as any).text : String(first);

  const cleaned = String(rawText)
    .trim()
    // common: ```json ... ```
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();

  const tryParse = (s: string) => {
    try {
      return JSON.parse(s);
    } catch {
      return null;
    }
  };

  // 1) Fast path
  const direct = tryParse(cleaned);
  if (direct) {
    cache.set(cacheKey, direct);
    return direct;
  }

  // 2) Best-effort: extract the first JSON object/array from the text.
  const extractFirstJson = (s: string): string | null => {
    const start = s.search(/[\[{]/);
    if (start < 0) return null;

    // Try to find a matching closing brace/bracket by scanning and tracking depth.
    const openChar = s[start];
    const closeChar = openChar === "[" ? "]" : "}";

    let depth = 0;
    let inString = false;
    let escape = false;

    for (let i = start; i < s.length; i++) {
      const ch = s[i];
      if (inString) {
        if (escape) {
          escape = false;
        } else if (ch === "\\") {
          escape = true;
        } else if (ch === '"') {
          inString = false;
        }
        continue;
      }

      if (ch === '"') {
        inString = true;
        continue;
      }

      if (ch === openChar) depth++;
      if (ch === closeChar) depth--;

      if (depth === 0) {
        return s.slice(start, i + 1);
      }
    }

    return null;
  };

  const extracted = extractFirstJson(cleaned);
  if (extracted) {
    const parsed = tryParse(extracted);
    if (parsed) {
      cache.set(cacheKey, parsed);
      return parsed;
    }
  }

  // 3) One retry: ask the model to re-emit *only* valid JSON.
  try {
    const repairSystem = `${system}\n\nYou MUST return COMPLETE, VALID JSON only. No code fences. No commentary.`;
    const repairUser = `Your previous output was invalid/truncated JSON. Re-output the full JSON now.\n\nOriginal request:\n${user}`;

    const repairResp = await axios.post(
      ANTHROPIC_URL,
      {
        model: config.defaultModel,
        max_tokens: Math.max(maxTokens ?? config.maxTokens, 8192),
        temperature: 0,
        system: repairSystem,
        messages: [{ role: "user", content: repairUser }],
      },
      { headers: headers() }
    );

    const repairContent = (repairResp.data as any)?.content;
    const repairFirst = Array.isArray(repairContent) && repairContent.length ? repairContent[0] : "";
    const repairRaw =
      typeof repairFirst === "object" && repairFirst && "text" in repairFirst
        ? (repairFirst as any).text
        : String(repairFirst);

    const repairCleaned = String(repairRaw)
      .trim()
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```\s*$/i, "")
      .trim();

    const repairedDirect = tryParse(repairCleaned);
    if (repairedDirect) {
      cache.set(cacheKey, repairedDirect);
      return repairedDirect;
    }

    const repairedExtracted = extractFirstJson(repairCleaned);
    if (repairedExtracted) {
      const repairedParsed = tryParse(repairedExtracted);
      if (repairedParsed) {
        cache.set(cacheKey, repairedParsed);
        return repairedParsed;
      }
    }
  } catch {
    // fall through to error below
  }

  const preview = String(rawText).slice(0, 5000);
  throw new Error(
    `Anthropic returned non-JSON (or invalid JSON). First 5k chars:\n${preview}`
  );
}

router.get("/models", async (_req, res) => {
  try {
    const response = await axios.get("https://api.anthropic.com/v1/models", {
      headers: headers(),
    });
    res.json(response.data);
  } catch (err: any) {
    if (axios.isAxiosError(err)) {
      const status = err.response?.status;
      const data = err.response?.data;
      return res.status(status || 500).json({
        error: "Failed to list Anthropic models",
        details: data || err.message,
      });
    }
    res.status(500).json({ error: "Failed to list Anthropic models", details: err?.message || String(err) });
  }
});

router.post("/outline", async (req, res) => {
  try {
    const userIdea = String((req.body as any)?.userIdea || "").trim();
    if (!userIdea) return res.status(400).json({ error: "userIdea required" });

    const system = `
You are a presentation design expert that outputs STRICT JSON only.

Return JSON:
{
  "title": "string",
  "overallTheme": "string",
  "colorScheme": {
    "primary": "#RRGGBB",
    "secondary": "#RRGGBB",
    "accent": "#RRGGBB",
    "background": "#RRGGBB",
    "text": "#RRGGBB"
  },
  "sections": [
    {"title":"string","startIndex":0,"endIndex":3}
  ],
  "slides": [
    {
      "title": "string",
      "slideType": "title" | "content" | "comparison" | "image" | "quote",
      "intent": "agenda"|"definition"|"process"|"caseStudy"|"metrics"|"recommendation"|"risk"|"summary"|"timeline"|"other",
      "priority": 1 | 2 | 3,
      "visualHint": "string",
      "kicker": "string",
      "content": ["string", "..."],
      "dataPoints": ["string", "..."],
      "notes": "string",
      "suggestedLayout": "string"
    }
  ]
}

Rules:
- Slides must be slide-ready (no paragraphs).
- Do NOT invent citations.
- Use "visualHint" as a short image/visual search phrase.
- "sections" must cover the deck in order (excluding the title slide is fine).
`.trim();

    const cacheKey = `outline:${userIdea}`;
    // Outlines can be long; give the model enough room to finish valid JSON.
    const json = await anthropicJsonRequest(cacheKey, system, userIdea, 8192);
    res.json(json);
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.error(err);
    res.status(500).json({ error: "Failed to generate outline", details: err.message });
  }
});

router.post("/research", async (req, res) => {
  try {
    const topic = String((req.body as any)?.topic || "").trim();
    const depth = (((req.body as any)?.depth || "quick") as "quick" | "detailed" | "deep");
    if (!topic) return res.status(400).json({ error: "topic required" });

    const system = `
You are a research assistant for presentation authors.

Return STRICT JSON:
{
  "keyFacts": ["string", "..."],
  "recentDevelopments": ["string", "..."],
  "expertPerspectives": ["string", "..."],
  "examples": ["string", "..."],
  "dataPoints": ["string", "..."],
  "counterpoints": ["string", "..."],
  "terms": [{"term":"string","definition":"string"}]
}

Rules:
- Provide slide-ready bullets.
- Be concrete. Prefer numbers, dates, and names when known.
- If unsure, say so; do not invent citations.
`.trim();

    const userPrompt = `Research topic for PowerPoint slides:\nTopic: ${topic}\nDepth: ${depth}`;

    const cacheKey = `research:${depth}:${topic}`;

    const maxTok = depth === "deep" ? 12000 : depth === "detailed" ? 8192 : 3072;
    const json = await anthropicJsonRequest(cacheKey, system, userPrompt, maxTok);
    res.json(json);
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.error(err);
    res.status(500).json({ error: "Failed to research topic", details: err.message });
  }
});

router.post("/fact-check", async (req, res) => {
  try {
    const claim = String((req.body as any)?.claim || "").trim();
    if (!claim) return res.status(400).json({ error: "claim required" });

    const system = `
You are a fact-checking assistant.

Return STRICT JSON:
{
  "claim": "string",
  "verdict": "true" | "false" | "uncertain",
  "explanation": "string",
  "sources": ["string", "..."]
}
`.trim();

    const cacheKey = `factcheck:${claim}`;
    const json = await anthropicJsonRequest(cacheKey, system, claim, 2048);
    res.json(json);
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.error(err);
    res.status(500).json({ error: "Failed to fact check", details: err.message });
  }
});

/**
 * Export a generated outline to a downloadable .pptx.
 * POST body: { outline: <PresentationOutline JSON> }
 */
async function finalizeOutlineForRender(reqBody: any) {
  const outline = reqBody?.outline;
  const useAi = reqBody?.useAi !== false; // default true
  const allowExternalImages = reqBody?.allowExternalImages === true;
  const allowGeneratedImages = reqBody?.allowGeneratedImages === true;
  const imageStyle = ((reqBody?.imageStyle || "photo") as "photo" | "illustration");

  if (!outline) throw new Error("outline required");

  enforceThemeStyle(outline);

  // 1) Choose a layout for each slide first.
  // Layout variants can include image boxes even before we have images; we'll fill those next.
  await enrichOutlineWithLayouts(outline, { anthropicJsonRequest });

  // 2) Determine which slides actually have space reserved for an image.
  const slides: any[] = Array.isArray((outline as any)?.slides) ? (outline as any).slides : [];
  const indicesNeedingImage: number[] = [];
  for (let i = 0; i < slides.length; i++) {
    const s = slides[i];
    if (!s) continue;
    const variantName = String(s?.layoutPlan?.variant || "");
    const variant = variantName ? getVariantByName(variantName) : null;
    const hasImageBox = !!variant?.boxes?.some((b) => b.kind === "imageCard" || b.kind === "fullBleedImage");
    if (hasImageBox) indicesNeedingImage.push(i);
  }

  const maxDeckImages = Math.max(0, Math.min(indicesNeedingImage.length, 20));

  const enrichment = await enrichOutlineWithImages(outline, {
    allowExternalImages,
    allowGeneratedImages,
    imageStyle,
    maxDeckImages,
    // Only fill slides that have image space in the chosen layout.
    onlySlideIndices: indicesNeedingImage,
    // Wikimedia APIs will rate-limit; keep this conservative.
    concurrency: allowExternalImages ? 1 : 2,
  });

  // 3) Optional: tweak typography and add simple shapes (still deterministic rendering).
  if (useAi) {
    await enrichOutlineWithStyles(outline, { anthropicJsonRequest });
  }

  return { outline, enrichment, useAi };
}

// Finalize an outline (images + layout plans + style plans) WITHOUT rendering HTML.
// This supports the "Generate presentation" flow so the user immediately has a finished deck.
router.post("/theme-from-prompt", async (req, res) => {
  try {
    const outline = (req.body as any)?.outline;
    const themePrompt = String((req.body as any)?.themePrompt || "").trim();
    if (!outline) return res.status(400).json({ error: "outline required" });
    if (!themePrompt) return res.status(400).json({ error: "themePrompt required" });

    const system = `You are a presentation theme designer.

Return STRICT JSON only:
{
  "look": "default|light|dark|bold",
  "themeStyle": {
    "mood": "calm|energetic|serious|playful",
    "background": "solid|subtleGradient",
    "panels": "glass|flat",
    "contrast": "auto|high"
  },
  "colorScheme": {
    "primary": "#RRGGBB",
    "secondary": "#RRGGBB",
    "accent": "#RRGGBB",
    "background": "#RRGGBB",
    "text": "#RRGGBB"
  }
}

Rules:
- Prefer practical, PPT-friendly themes.
- Keep strong contrast for readability.
- Use ONLY hex colors.
- No extra keys, no markdown.`.trim();

    const user = `Deck title: ${String((outline as any)?.title || "").slice(0, 120)}
Existing colors (if any): ${JSON.stringify((outline as any)?.colorScheme || {})}
Existing look: ${String((outline as any)?.look || "default")}

Theme prompt:
${themePrompt}`;

    const cacheKey = `theme:${String((outline as any)?.title || "deck").slice(0, 60)}:${themePrompt.slice(0, 200)}`;
    const json = await anthropicJsonRequest(cacheKey, system, user, 900);

    (outline as any).look = String((json as any)?.look || (outline as any).look || "default");
    (outline as any).themeStyle = (json as any)?.themeStyle || (outline as any).themeStyle;
    (outline as any).colorScheme = (json as any)?.colorScheme || (outline as any).colorScheme;
    (outline as any).themePrompt = themePrompt;

    enforceThemeStyle(outline);

    res.json({ outline });
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.error(err);
    res.status(500).json({ error: "Failed to generate theme", details: err.message });
  }
});

router.post("/decorate-outline", async (req, res) => {
  try {
    const outline = (req.body as any)?.outline;
    const decoratePrompt = String((req.body as any)?.decoratePrompt || "").trim();
    const allowExternalImages = (req.body as any)?.allowExternalImages === true;
    const allowGeneratedImages = (req.body as any)?.allowGeneratedImages === true;
    const imageStyle = (((req.body as any)?.imageStyle || "photo") as "photo" | "illustration");

    if (!outline) return res.status(400).json({ error: "outline required" });
    if (!decoratePrompt) return res.status(400).json({ error: "decoratePrompt required" });

    (outline as any).decoratePrompt = decoratePrompt;
    enforceThemeStyle(outline);

    // Layouts first
    await enrichOutlineWithLayouts(outline, { anthropicJsonRequest });

    // Optional: deterministic section labels if requested
    const wantsSections = /\bsections?\b/i.test(decoratePrompt) || /\bsectioning\b/i.test(decoratePrompt);
    if (wantsSections) {
      const slides: any[] = Array.isArray((outline as any)?.slides) ? (outline as any).slides : [];
      const groupSize = 4;
      for (let i = 0; i < slides.length; i++) {
        const s = slides[i];
        if (!s) continue;
        if (String(s.slideType || "").toLowerCase() === "title") continue;
        const sectionIndex = Math.floor(i / groupSize) + 1;
        (s as any).kicker = `SECTION ${sectionIndex}`;
      }
    }

    // Fill images only where layout reserves image space
    const slides: any[] = Array.isArray((outline as any)?.slides) ? (outline as any).slides : [];
    const indicesNeedingImage: number[] = [];
    for (let i = 0; i < slides.length; i++) {
      const s = slides[i];
      if (!s) continue;
      const variantName = String(s?.layoutPlan?.variant || "");
      const variant = variantName ? getVariantByName(variantName) : null;
      const hasImageBox = !!variant?.boxes?.some((b) => b.kind === "imageCard" || b.kind === "fullBleedImage");
      if (hasImageBox) indicesNeedingImage.push(i);
    }

    const maxDeckImages = Math.max(0, Math.min(indicesNeedingImage.length, 40));

    const enrichment = await enrichOutlineWithImages(outline, {
      allowExternalImages,
      allowGeneratedImages,
      imageStyle,
      maxDeckImages,
      onlySlideIndices: indicesNeedingImage,
      concurrency: allowExternalImages ? 1 : 2,
    });

    // Style pass (shapes/typography) after layouts+images
    await enrichOutlineWithStyles(outline, { anthropicJsonRequest });

    res.json({ outline, enrichment });
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.error(err);
    res.status(500).json({ error: "Failed to decorate outline", details: err.message });
  }
});

// Decorate a single slide (iterate quickly without reworking the whole deck)
router.post("/decorate-slide", async (req, res) => {
  try {
    const outline = (req.body as any)?.outline;
    const decoratePrompt = String((req.body as any)?.decoratePrompt || "").trim();
    const slideIndex = Number((req.body as any)?.slideIndex);
    const allowExternalImages = (req.body as any)?.allowExternalImages === true;
    const allowGeneratedImages = (req.body as any)?.allowGeneratedImages === true;
    const imageStyle = (((req.body as any)?.imageStyle || "photo") as "photo" | "illustration");

    if (!outline) return res.status(400).json({ error: "outline required" });
    if (!Number.isFinite(slideIndex)) return res.status(400).json({ error: "slideIndex required" });

    (outline as any).decoratePrompt = decoratePrompt;
    enforceThemeStyle(outline);

    // Ensure layouts exist
    await enrichOutlineWithLayouts(outline, { anthropicJsonRequest });

    const slides: any[] = Array.isArray((outline as any)?.slides) ? (outline as any).slides : [];
    if (slideIndex < 0 || slideIndex >= slides.length) {
      return res.status(400).json({ error: `slideIndex out of range (0..${Math.max(0, slides.length - 1)})` });
    }

    const s = slides[slideIndex];
    const variantName = String(s?.layoutPlan?.variant || "");
    const variant = variantName ? getVariantByName(variantName) : null;
    const hasImageBox = !!variant?.boxes?.some((b) => b.kind === "imageCard" || b.kind === "fullBleedImage");

    const enrichment = await enrichOutlineWithImages(outline, {
      allowExternalImages,
      allowGeneratedImages,
      imageStyle,
      maxDeckImages: hasImageBox ? 1 : 0,
      onlySlideIndices: hasImageBox ? [slideIndex] : [],
      concurrency: allowExternalImages ? 1 : 2,
    });

    await enrichOutlineWithStyles(outline, { anthropicJsonRequest });

    res.json({ outline, enrichment });
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.error(err);
    res.status(500).json({ error: "Failed to decorate slide", details: err.message });
  }
});

router.post("/finalize-outline", async (req, res) => {
  try {
    const { outline, enrichment } = await finalizeOutlineForRender(req.body);
    res.json({ outline, enrichment });
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.error(err);
    res.status(500).json({ error: "Failed to finalize outline", details: err.message });
  }
});

router.post("/deck-html", async (req, res) => {
  try {
    const { outline, enrichment, useAi } = await finalizeOutlineForRender(req.body);

    // Rendering is still deterministic: layoutPlan selects from known variants.
    const slidesHtml = useAi
      ? await outlineToAiSlides(outline, anthropicJsonRequest, { concurrency: 2 })
      : outlineToStyledSlides(outline);

    const html = wrapDeckHtml(slidesHtml, outline);
    res.json({ html, enrichment });
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.error(err);
    res.status(500).json({ error: "Failed to generate deck HTML", details: err.message });
  }
});

router.post("/export-pdf", async (req, res) => {
  try {
    const outline = (req.body as any)?.outline;
    const useAi = (req.body as any)?.useAi !== false; // default true
    const allowExternalImages = (req.body as any)?.allowExternalImages === true;
    const allowGeneratedImages = (req.body as any)?.allowGeneratedImages === true;
    const imageStyle = (((req.body as any)?.imageStyle || "photo") as "photo" | "illustration");
    if (!outline) return res.status(400).json({ error: "outline required" });

    enforceThemeStyle(outline);

    // Layouts first, then only fill slides that actually have space for an image.
    await enrichOutlineWithLayouts(outline, { anthropicJsonRequest });

    const slides: any[] = Array.isArray((outline as any)?.slides) ? (outline as any).slides : [];
    const indicesNeedingImage: number[] = [];
    for (let i = 0; i < slides.length; i++) {
      const s = slides[i];
      if (!s) continue;
      const variantName = String(s?.layoutPlan?.variant || "");
      const variant = variantName ? getVariantByName(variantName) : null;
      const hasImageBox = !!variant?.boxes?.some((b) => b.kind === "imageCard" || b.kind === "fullBleedImage");
      if (hasImageBox) indicesNeedingImage.push(i);
    }

    const maxDeckImages = Math.max(0, Math.min(indicesNeedingImage.length, 20));

    const enrichment = await enrichOutlineWithImages(outline, {
      allowExternalImages,
      allowGeneratedImages,
      imageStyle,
      maxDeckImages,
      onlySlideIndices: indicesNeedingImage,
      // Wikimedia APIs will rate-limit; keep this conservative.
      concurrency: allowExternalImages ? 1 : 2,
    });

    // Always-on: ask AI to choose a grid-based layout variant for each slide.
    // (already done above)

    if (useAi) {
      await enrichOutlineWithStyles(outline, { anthropicJsonRequest });
    }

    // Build one combined HTML doc with page breaks.
    // Note: rendering uses the deterministic design system in deckHtml.ts.
    let slidesHtml: string;
    if (useAi) {
      slidesHtml = await outlineToAiSlides(outline, anthropicJsonRequest, { concurrency: 2 });
    } else {
      slidesHtml = outlineToStyledSlides(outline);
    }

    const html = wrapDeckHtml(slidesHtml, outline);
    const pdfBuf = await renderHtmlToPdfBuffer(html);

    const title = String(outline?.title || "deck")
      .replace(/[^a-z0-9\- _]/gi, "")
      .trim()
      .replace(/\s+/g, "_")
      .slice(0, 60);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${title || "deck"}.pdf"`);
    res.send(pdfBuf);
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.error(err);
    res.status(500).json({ error: "Failed to export pdf", details: err.message });
  }
});

router.post("/export-pptx", async (req, res) => {
  try {
    const outline = (req.body as any)?.outline;
    const allowExternalImages = (req.body as any)?.allowExternalImages === true;
    const allowGeneratedImages = (req.body as any)?.allowGeneratedImages === true;
    const imageStyle = (((req.body as any)?.imageStyle || "photo") as "photo" | "illustration");
    if (!outline) return res.status(400).json({ error: "outline required" });

    enforceThemeStyle(outline);

    // Layouts first, then only fill slides that actually have space for an image.
    await enrichOutlineWithLayouts(outline, { anthropicJsonRequest });

    const slides: any[] = Array.isArray((outline as any)?.slides) ? (outline as any).slides : [];
    const indicesNeedingImage: number[] = [];
    for (let i = 0; i < slides.length; i++) {
      const s = slides[i];
      if (!s) continue;
      const variantName = String(s?.layoutPlan?.variant || "");
      const variant = variantName ? getVariantByName(variantName) : null;
      const hasImageBox = !!variant?.boxes?.some((b) => b.kind === "imageCard" || b.kind === "fullBleedImage");
      if (hasImageBox) indicesNeedingImage.push(i);
    }

    const maxDeckImages = Math.max(0, Math.min(indicesNeedingImage.length, 20));

    // Enrich for PPTX too so images/layout plans exist.
    await enrichOutlineWithImages(outline, {
      allowExternalImages,
      allowGeneratedImages,
      imageStyle,
      maxDeckImages,
      onlySlideIndices: indicesNeedingImage,
      // Wikimedia APIs will rate-limit; keep this conservative.
      concurrency: allowExternalImages ? 1 : 2,
    });

    // (layouts already done above)

    await enrichOutlineWithStyles(outline, { anthropicJsonRequest });

    const buf = await buildPptxBuffer(outline);
    const title = String(outline?.title || "presentation")
      .replace(/[^a-z0-9\- _]/gi, "")
      .trim()
      .replace(/\s+/g, "_")
      .slice(0, 60);

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation"
    );
    res.setHeader("Content-Disposition", `attachment; filename="${title || "presentation"}.pptx"`);
    res.send(buf);
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.error(err);
    res.status(500).json({ error: "Failed to export pptx", details: err.message });
  }
});

/**
 * Apply an edit instruction ("message") to an existing outline.
 * POST body: { outline: <PresentationOutline JSON>, message: "..." }
 */
router.post("/edit-outline", async (req, res) => {
  try {
    const outline = (req.body as any)?.outline;
    const message = String((req.body as any)?.message || "").trim();
    if (!outline) return res.status(400).json({ error: "outline required" });
    if (!message) return res.status(400).json({ error: "message required" });

    const system = `
You are a presentation editor.

You will be given an existing presentation outline JSON and an edit instruction.
Return STRICT JSON only, with the SAME schema as the outline.
- Preserve content unless the instruction requests a change.
- Preserve the number of slides and slide ordering unless the instruction explicitly asks to add/remove/reorder slides.
- Make sure content is slide-ready bullet points.
`.trim();

    const userPrompt = `Existing outline JSON:\n${JSON.stringify(outline)}\n\nEdit instruction:\n${message}`;

    // Cache key includes both outline and message.
    const cacheKey = `edit:${message}:${JSON.stringify(outline).slice(0, 2000)}`;
    const json = await anthropicJsonRequest(cacheKey, system, userPrompt, 4096);
    res.json(json);
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.error(err);
    res.status(500).json({ error: "Failed to edit outline", details: err.message });
  }
});

/**
 * Upload a PPTX and convert it into an outline JSON (so it can be edited by Anthropic).
 * multipart/form-data field: file
 * response: { extractedText, outline }
 */
router.post("/import-pptx", upload.single("file"), async (req, res) => {
  try {
    const file = (req as any).file as any | undefined;
    if (!file) return res.status(400).json({ error: "file required" });

    const extractedText = await extractTextFromPptxBuffer(file.buffer);

    const system = `
You are a presentation reverse-engineer.

Given extracted slide text from an existing PowerPoint deck, reconstruct a best-effort outline in STRICT JSON with this schema:
{
  "title": "string",
  "overallTheme": "string",
  "colorScheme": {
    "primary": "string",
    "secondary": "string",
    "accent": "string",
    "background": "string",
    "text": "string"
  },
  "slides": [
    {
      "title": "string",
      "slideType": "title" | "content" | "comparison" | "image" | "quote",
      "content": ["string"],
      "notes": "string",
      "suggestedLayout": "string"
    }
  ]
}
Rules:
- Use concise titles.
- Convert paragraphs into bullets.
- If a slide has little text, infer a reasonable title.
- Do not invent citations.
`.trim();

    const userPrompt = `Extracted deck text (slide by slide):\n\n${extractedText}`;

    const cacheKey = `import:${file.originalname}:${file.size}`;
    const outline = await anthropicJsonRequest(cacheKey, system, userPrompt, 4096);

    res.json({ extractedText, outline });
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.error(err);
    res.status(500).json({ error: "Failed to import pptx", details: err.message });
  }
});

router.post("/edit-slide", async (req, res) => {
  try {
    const outline = (req.body as any)?.outline;
    const message = String((req.body as any)?.message || "").trim();
    const slideIndex = Number((req.body as any)?.slideIndex);
    if (!outline) return res.status(400).json({ error: "outline required" });
    if (!Number.isFinite(slideIndex)) return res.status(400).json({ error: "slideIndex required" });
    if (!message) return res.status(400).json({ error: "message required" });

    const slides = Array.isArray((outline as any)?.slides) ? (outline as any).slides : [];
    if (slideIndex < 0 || slideIndex >= slides.length) {
      return res.status(400).json({ error: `slideIndex out of range (0..${Math.max(0, slides.length - 1)})` });
    }

    const system = `
You are a presentation editor.

You will be given an existing presentation outline JSON, a target slide index, and an edit instruction.
Return STRICT JSON only, with the SAME schema as the outline.

Rules:
- Only modify the slide at the given index.
- Preserve the number of slides and slide ordering.
- Do NOT regenerate the entire deck.
- You MAY adjust: slide.title, slide.content bullets, slide.notes, slide.describe, slide.look.
- Do NOT remove images or change imageDataUri.
- Keep bullets slide-ready, concise.
`.trim();

    const userPrompt = `Slide index to edit: ${slideIndex}

Edit instruction:
${message}

Existing outline JSON:
${JSON.stringify(outline)}`;

    const cacheKey = `editSlide:${slideIndex}:${message}:${JSON.stringify(slides[slideIndex] || {}).slice(0, 1500)}`;
    const json = await anthropicJsonRequest(cacheKey, system, userPrompt, 4096);
    res.json(json);
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.error(err);
    res.status(500).json({ error: "Failed to edit slide", details: err.message });
  }
});

router.post("/slide-html", async (req, res) => {
  try {
    const outline = (req.body as any)?.outline;
    const slideIndex = Number((req.body as any)?.slideIndex);
    const useAi = (req.body as any)?.useAi !== false;
    const allowExternalImages = (req.body as any)?.allowExternalImages === true;
    const allowGeneratedImages = (req.body as any)?.allowGeneratedImages === true;
    const imageStyle = (((req.body as any)?.imageStyle || "photo") as "photo" | "illustration");
    if (!outline) return res.status(400).json({ error: "outline required" });
    if (!Number.isFinite(slideIndex)) return res.status(400).json({ error: "slideIndex required" });

    const slides = Array.isArray((outline as any)?.slides) ? (outline as any).slides : [];
    if (slideIndex < 0 || slideIndex >= slides.length) {
      return res.status(400).json({ error: `slideIndex out of range (0..${Math.max(0, slides.length - 1)})` });
    }

    // Layouts first, then only fill slides that actually have space for an image.
    await enrichOutlineWithLayouts(outline, { anthropicJsonRequest });

    const slidesCount = Array.isArray((outline as any)?.slides) ? (outline as any).slides.length : 0;
    const slidesAll: any[] = Array.isArray((outline as any)?.slides) ? (outline as any).slides : [];
    const indicesNeedingImage: number[] = [];
    for (let i = 0; i < slidesAll.length; i++) {
      const s = slidesAll[i];
      if (!s) continue;
      const variantName = String(s?.layoutPlan?.variant || "");
      const variant = variantName ? getVariantByName(variantName) : null;
      const hasImageBox = !!variant?.boxes?.some((b) => b.kind === "imageCard" || b.kind === "fullBleedImage");
      if (hasImageBox) indicesNeedingImage.push(i);
    }

    const maxDeckImages = Math.max(0, Math.min(indicesNeedingImage.length, Math.min(slidesCount, 20)));

    await enrichOutlineWithImages(outline, {
      allowExternalImages,
      allowGeneratedImages,
      imageStyle,
      maxDeckImages,
      onlySlideIndices: indicesNeedingImage,
      // Wikimedia APIs will rate-limit; keep this conservative.
      concurrency: allowExternalImages ? 1 : 2,
    });

    // (layouts already done above)
    if (useAi) await enrichOutlineWithStyles(outline, { anthropicJsonRequest });

    // Render full deck then extract the requested slide section.
    const slidesHtml = await outlineToStyledSlides(outline);
    const sections = String(slidesHtml).split(/\n(?=<section class="slide")/g);
    const target = sections[slideIndex] || "";
    const html = wrapDeckHtml(target, outline);

    res.json({ html });
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.error(err);
    res.status(500).json({ error: "Failed to generate slide HTML", details: err.message });
  }
});

export default router;
