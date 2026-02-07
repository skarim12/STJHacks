import axios from "axios";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";

export interface SlideOutline {
  title: string;
  bulletPoints: string[];
}

export interface GenerateSlidesResult {
  refinedPrompt: string;
  slides: SlideOutline[];
}

export async function callAnthropicForSlides(
  roughIdea: string
): Promise<GenerateSlidesResult> {
  const systemPrompt = `
You are an AI assistant that converts a rough presentation idea into a highly structured slide outline for Microsoft PowerPoint.

Requirements:
- Output must be STRICT JSON.
- JSON shape:
  {
    "refinedPrompt": "string",
    "slides": [
      {
        "title": "string",
        "bulletPoints": ["string", "..."]
      }
    ]
  }
- Do NOT include any additional text outside the JSON.
- Slides should be concise, business-friendly, and logically ordered.
  `.trim();

  const userPrompt = `
Rough presentation idea:
${roughIdea}
  `.trim();

  const response = await axios.post(
    ANTHROPIC_API_URL,
    {
      model: "claude-3.5-sonnet",
      max_tokens: 1024,
      temperature: 0.3,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: userPrompt
        }
      ]
    },
    {
      headers: {
        "anthropic-version": "2023-06-01",
        "content-type": "application/json"
      }
    }
  );

  const content = response.data?.content;
  if (!Array.isArray(content) || content.length === 0) {
    throw new Error("Unexpected Anthropic response format.");
  }

  const first = content[0];
  const text =
    typeof first === "object" && "text" in first ? (first as any).text : String(first);

  const parsed = JSON.parse(text);
  if (!parsed.slides || !Array.isArray(parsed.slides)) {
    throw new Error("Anthropic response missing 'slides' array.");
  }
  if (typeof parsed.refinedPrompt !== "string") {
    parsed.refinedPrompt = "";
  }

  return parsed as GenerateSlidesResult;
}

export interface ResearchResult {
  title: string;
  summary: string;
  bullets: string[];
}

export async function callAnthropicForResearch(
  topic: string
): Promise<ResearchResult> {
  const systemPrompt = `
You are an AI research assistant helping prepare slide content for Microsoft PowerPoint.

Return STRICT JSON only:
{
  "title": "string",
  "summary": "string",
  "bullets": ["string", "..."]
}
  `.trim();

  const userPrompt = `
Research topic (for presentation slides):
${topic}
  `.trim();

  const response = await axios.post(
    ANTHROPIC_API_URL,
    {
      model: "claude-3.5-sonnet",
      max_tokens: 1024,
      temperature: 0.2,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: userPrompt
        }
      ]
    },
    {
      headers: {
        "anthropic-version": "2023-06-01",
        "content-type": "application/json"
      }
    }
  );

  const content = response.data?.content;
  if (!Array.isArray(content) || content.length === 0) {
    throw new Error("Unexpected Anthropic response format.");
  }

  const first = content[0];
  const text =
    typeof first === "object" && "text" in first ? (first as any).text : String(first);

  const parsed = JSON.parse(text);
  if (!parsed.bullets || !Array.isArray(parsed.bullets)) {
    parsed.bullets = [];
  }
  if (typeof parsed.title !== "string") parsed.title = topic;
  if (typeof parsed.summary !== "string") parsed.summary = "";

  return parsed as ResearchResult;
}