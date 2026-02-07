import { Router } from "express";
import axios from "axios";
import { config } from "./config";
import {
  PresentationOutline,
  ResearchResult,
  FactCheckResult
} from "../../src/types";

const router = Router();
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

function anthropicHeaders() {
  if (!config.anthropicApiKey) {
    throw new Error("Anthropic API key not configured");
  }
  return {
    "x-api-key": config.anthropicApiKey,
    "anthropic-version": "2023-06-01",
    "content-type": "application/json"
  };
}

async function anthropicJsonRequest(system: string, user: string, maxTokens = 4096) {
  const response = await axios.post(
    ANTHROPIC_URL,
    {
      model: "claude-3.5-sonnet",
      max_tokens: maxTokens,
      temperature: 0.5,
      system,
      messages: [{ role: "user", content: user }]
    },
    { headers: anthropicHeaders() }
  );

  const content = response.data?.content;
  if (!Array.isArray(content) || content.length === 0) {
    throw new Error("Unexpected Anthropic response format");
  }
  const first = content[0];
  const text =
    typeof first === "object" && "text" in first ? (first as any).text : String(first);
  return JSON.parse(text);
}

// POST /api/outline
router.post("/outline", async (req, res) => {
  try {
    const idea = String(req.body?.userIdea || "").trim();
    if (!idea) {
      return res.status(400).json({ error: "userIdea is required" });
    }

    const prefs = req.body?.preferences;
    const prefsText = prefs
      ? `User preferences:
- Tone: ${prefs.tone}
- Audience: ${prefs.audience}
- Slide count preference: ${prefs.slideCount}
- Include research: ${prefs.includeResearch}`
      : "";

    const system = `
You are a presentation design expert that outputs STRICT JSON only.

Return JSON with shape:
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
No explanation, ONLY JSON.
`.trim();

    const userPrompt = `
Create a structured PowerPoint outline from this idea:

"${idea}"

${prefsText}
`.trim();

    const json: PresentationOutline = await anthropicJsonRequest(system, userPrompt);
    res.json(json);
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.error(err);
    res.status(500).json({ error: "Failed to generate outline", details: err.message });
  }
});

// POST /api/research
router.post("/research", async (req, res) => {
  try {
    const topic = String(req.body?.topic || "").trim();
    const depth = (req.body?.depth || "quick") as "quick" | "detailed";
    if (!topic) {
      return res.status(400).json({ error: "topic is required" });
    }

    const system = `
You are a research assistant for presentation authors.
Return STRICT JSON only:

{
  "keyFacts": ["string", "..."],
  "recentDevelopments": ["string", "..."],
  "expertPerspectives": ["string", "..."],
  "examples": ["string", "..."]
}
`.trim();

    const userPrompt = `
Research the following topic for a PowerPoint presentation.

Include:
1. Key facts and statistics
2. Recent developments (2024-2025)
3. Expert perspectives
4. Relevant examples or case studies

Topic: ${topic}
Depth: ${depth}
`.trim();

    const maxTokens = depth === "detailed" ? 8192 : 2048;
    const json: ResearchResult = await anthropicJsonRequest(system, userPrompt, maxTokens);
    res.json(json);
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.error(err);
    res.status(500).json({ error: "Failed to research topic", details: err.message });
  }
});

// POST /api/fact-check
router.post("/fact-check", async (req, res) => {
  try {
    const claim = String(req.body?.claim || "").trim();
    if (!claim) {
      return res.status(400).json({ error: "claim is required" });
    }

    const system = `
You are a fact-checking assistant.
Return STRICT JSON only:

{
  "claim": "string",
  "verdict": "true" | "false" | "uncertain",
  "explanation": "string",
  "sources": ["string", "..."]
}
`.trim();

    const userPrompt = `
Fact-check this claim for a presentation:

"${claim}"
`.trim();

    const json: FactCheckResult = await anthropicJsonRequest(system, userPrompt, 2048);
    res.json(json);
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.error(err);
    res.status(500).json({ error: "Failed to fact check", details: err.message });
  }
});

export default router;