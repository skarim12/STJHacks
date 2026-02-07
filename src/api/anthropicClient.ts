import axios from "axios";
import type { SlideOutline } from "../state/usePresentationStore";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";

// NOTE: Replace this with your own secure mechanism.
// For development, you might set (e.g. window.ANTHROPIC_API_KEY = "sk-...")
// NEVER hard-code secrets in production.
declare global {
  interface Window {
    ANTHROPIC_API_KEY?: string;
  }
}

export async function generateSlideOutlines(
  roughIdea: string
): Promise<{
  refinedPrompt: string;
  slides: SlideOutline[];
}> {
  if (!window.ANTHROPIC_API_KEY) {
    throw new Error("Anthropic API key is not configured.");
  }

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
      model: "claude-3.5-sonnet", // adjust to exact model name you want
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
        "x-api-key": window.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json"
      },
      timeout: 60_000
    }
  );

  // Anthropic "messages" API returns an array of content blocks.
  const content = response.data?.content;
  if (!Array.isArray(content) || content.length === 0) {
    throw new Error("Unexpected Anthropic response format.");
  }

  const textBlock = content[0];
  const text =
    typeof textBlock === "object" && "text" in textBlock
      ? (textBlock as any).text
      : String(textBlock);

  let parsed: { refinedPrompt: string; slides: SlideOutline[] };
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    throw new Error("Failed to parse Anthropic JSON response.");
  }

  if (!parsed.slides || !Array.isArray(parsed.slides)) {
    throw new Error("Anthropic response is missing 'slides' array.");
  }

  return parsed;
}