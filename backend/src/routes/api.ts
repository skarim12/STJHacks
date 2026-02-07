import { Router } from "express";
import axios from "axios";
import NodeCache from "node-cache";
import { config } from "../config/config";
import { buildPptxBuffer } from "../utils/pptx";
import multer from "multer";
import { extractTextFromPptxBuffer } from "../utils/pptxImport";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB
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
      throw new Error(
        `Anthropic request failed (status ${status}). Response: ${JSON.stringify(data)}`
      );
    }
    throw err;
  }

  const content = (response.data as any)?.content;
  if (!Array.isArray(content) || content.length === 0) {
    throw new Error("Unexpected Anthropic response");
  }

  const first = content[0];
  const text =
    typeof first === "object" && first && "text" in first ? (first as any).text : String(first);

  try {
    const json = JSON.parse(text);
    cache.set(cacheKey, json);
    return json;
  } catch (e: any) {
    const preview = String(text).slice(0, 5000);
    throw new Error(
      `Anthropic returned non-JSON (or invalid JSON). First 5k chars:\n${preview}`
    );
  }
}

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
- Keep slides array in a reasonable length; do not exceed 20 slides.
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
