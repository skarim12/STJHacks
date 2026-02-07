import { Router } from "express";
import axios from "axios";
import NodeCache from "node-cache";
import { config } from "../config/config";
import { buildPptxBuffer } from "../utils/pptx";
import multer from "multer";
import { extractTextFromPptxBuffer } from "../utils/pptxImport";
import { outlineToAiSlides, outlineToSimpleSlides, outlineToStyledSlides, wrapDeckHtml } from "../utils/deckHtml";
import { buildDefaultImageQuery, fetchSlideImageFromWikimedia } from "../utils/externalImages";
import { renderHtmlToPdfBuffer } from "../utils/htmlToPdf";

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
        temperature: 0.5,
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
      "content": ["string", "..."],
      "notes": "string",
      "suggestedLayout": "string"
    }
  ]
}
`.trim();

    const cacheKey = `outline:${userIdea}`;
    const json = await anthropicJsonRequest(cacheKey, system, userIdea);
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
    const depth = (((req.body as any)?.depth || "quick") as "quick" | "detailed");
    if (!topic) return res.status(400).json({ error: "topic required" });

    const system = `
You are a research assistant for presentation authors.

Return STRICT JSON:
{
  "keyFacts": ["string", "..."],
  "recentDevelopments": ["string", "..."],
  "expertPerspectives": ["string", "..."],
  "examples": ["string", "..."]
}
`.trim();

    const userPrompt = `Research topic for PowerPoint slides:\nTopic: ${topic}\nDepth: ${depth}`;

    const cacheKey = `research:${depth}:${topic}`;
    const json = await anthropicJsonRequest(cacheKey, system, userPrompt, depth === "detailed" ? 8192 : 2048);
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
router.post("/deck-html", async (req, res) => {
  try {
    const outline = (req.body as any)?.outline;
    const useAi = (req.body as any)?.useAi !== false; // default true
    const allowExternalImages = (req.body as any)?.allowExternalImages === true;
    if (!outline) return res.status(400).json({ error: "outline required" });

    if (allowExternalImages && Array.isArray(outline?.slides)) {
      // Deterministic rule: fetch up to N slide images max per deck.
      const maxDeckImages = 8;
      let used = 0;

      // Concurrency-limited fetch
      const slides = outline.slides as any[];
      let idx = 0;
      const workers = new Array(2).fill(0).map(async () => {
        while (idx < slides.length && used < maxDeckImages) {
          const i = idx++;
          const s = slides[i];
          if (!s || s.slideType === "title") continue;
          if (s.imageDataUri) continue;

          // Prefer images on image slides; otherwise every other slide.
          const normalizedType = String(s.slideType || "").toLowerCase();
          const wantsImage = normalizedType === "image" || normalizedType === "imageplaceholder" || (i % 2 === 1);
          if (!wantsImage) continue;

          const query = buildDefaultImageQuery({
            deckTitle: outline?.title,
            slideTitle: s?.title,
            bullets: Array.isArray(s?.content) ? s.content : [],
          });

          try {
            const img = await fetchSlideImageFromWikimedia({ query });
            if (img?.dataUri) {
              s.imageDataUri = img.dataUri;
              s.imageCredit = img.credit;
              s.imageSourcePage = img.sourcePage;
              used++;
            }
          } catch {
            // best-effort
          }
        }
      });
      await Promise.all(workers);
    }

    // Deterministic slide system: AI is allowed to assist content elsewhere,
    // but slide HTML rendering is guarded and stable.
    const slidesHtml = useAi
      ? await outlineToAiSlides(outline, anthropicJsonRequest, { concurrency: 2 })
      : outlineToStyledSlides(outline);

    const html = wrapDeckHtml(slidesHtml, outline);
    res.json({ html });
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
    if (!outline) return res.status(400).json({ error: "outline required" });

    if (allowExternalImages && Array.isArray(outline?.slides)) {
      const maxDeckImages = 8;
      let used = 0;
      const slides = outline.slides as any[];
      let idx = 0;
      const workers = new Array(2).fill(0).map(async () => {
        while (idx < slides.length && used < maxDeckImages) {
          const i = idx++;
          const s = slides[i];
          if (!s || s.slideType === "title") continue;
          if (s.imageDataUri) continue;
          const normalizedType = String(s.slideType || "").toLowerCase();
          const wantsImage = normalizedType === "image" || normalizedType === "imageplaceholder" || (i % 2 === 1);
          if (!wantsImage) continue;

          const query = buildDefaultImageQuery({
            deckTitle: outline?.title,
            slideTitle: s?.title,
            bullets: Array.isArray(s?.content) ? s.content : [],
          });

          try {
            const img = await fetchSlideImageFromWikimedia({ query });
            if (img?.dataUri) {
              s.imageDataUri = img.dataUri;
              s.imageCredit = img.credit;
              s.imageSourcePage = img.sourcePage;
              used++;
            }
          } catch {
            // best-effort
          }
        }
      });
      await Promise.all(workers);
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
    if (!outline) return res.status(400).json({ error: "outline required" });

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

export default router;
