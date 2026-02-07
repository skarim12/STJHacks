import { Router } from "express";
import axios from "axios";
import { config } from "../config/config";

const router = Router();

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

function headers() {
  if (!config.claudeApiKey) throw new Error("CLAUDE_API_KEY not set");
  return {
    "x-api-key": config.claudeApiKey,
    "anthropic-version": "2023-06-01",
    "content-type": "application/json",
  };
}

async function anthropicJsonRequest(system: string, user: string, maxTokens?: number) {
  const response = await axios.post(
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

  const content = (response.data as any)?.content;
  if (!Array.isArray(content) || content.length === 0) {
    throw new Error("Unexpected Anthropic response");
  }

  const first = content[0];
  const text = typeof first === "object" && first && "text" in first ? (first as any).text : String(first);

  return JSON.parse(text);
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

    const json = await anthropicJsonRequest(system, userIdea);
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

    const json = await anthropicJsonRequest(system, userPrompt, depth === "detailed" ? 8192 : 2048);
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

    const json = await anthropicJsonRequest(system, claim, 2048);
    res.json(json);
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.error(err);
    res.status(500).json({ error: "Failed to fact check", details: err.message });
  }
});

export default router;
