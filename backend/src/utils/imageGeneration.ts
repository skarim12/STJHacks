import axios from "axios";
import NodeCache from "node-cache";

export type GeneratedImage = {
  dataUri: string;
  provider: "openai";
  prompt: string;
};

const cache = new NodeCache({ stdTTL: 60 * 60 * 24 }); // 24h

function clamp(s: string, max: number): string {
  const t = String(s ?? "").trim().replace(/\s+/g, " ");
  return t.length <= max ? t : t.slice(0, max - 1).trimEnd() + "…";
}

function safePrompt(s: string): string {
  // Strip URLs/tags; keep it predictable
  return clamp(
    String(s ?? "")
      .replace(/<[^>]*>/g, "")
      .replace(/\bhttps?:\/\/\S+/gi, "")
      .trim(),
    500
  );
}

function openAiKey(): string {
  // Per user request: env var name is API_KEY
  const k = process.env.API_KEY || "";
  if (!k) throw new Error("API_KEY (OpenAI) not set");
  return k;
}

export async function generateSlideImageOpenAI(opts: {
  prompt: string;
  style?: "photo" | "illustration";
}): Promise<GeneratedImage> {
  const prompt = safePrompt(opts.prompt);
  if (!prompt) throw new Error("prompt required");

  const cacheKey = `openaiimg:${opts.style || "illustration"}:${prompt}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached as GeneratedImage;

  // gpt-image-1 returns base64 PNG via b64_json.
  // Size options are limited; use 1536x1024 (landscape-ish) then crop via CSS object-fit.
  const styleHint = opts.style === "photo" ? "photo-real" : "clean vector illustration";

  const fullPrompt = `${prompt}\n\nStyle: ${styleHint}. High contrast. No text in the image. 16:9 friendly composition.`;

  const resp = await axios.post(
    "https://api.openai.com/v1/images/generations",
    {
      model: "gpt-image-1",
      prompt: fullPrompt,
      size: "1536x1024",
      response_format: "b64_json",
    },
    {
      headers: {
        Authorization: `Bearer ${openAiKey()}`,
        "Content-Type": "application/json",
      },
      timeout: 60_000,
    }
  );

  const b64 = String(resp.data?.data?.[0]?.b64_json || "");
  if (!b64) throw new Error("OpenAI image generation returned no data");

  const out: GeneratedImage = {
    provider: "openai",
    prompt,
    dataUri: `data:image/png;base64,${b64}`,
  };

  cache.set(cacheKey, out);
  return out;
}
