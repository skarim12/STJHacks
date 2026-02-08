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
  // Support common env var names.
  const k = process.env.API_KEY || process.env.OPENAI_API_KEY || "";
  if (!k) throw new Error("OpenAI API key not set (set API_KEY or OPENAI_API_KEY in backend env)");
  return k;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function isRetryableOpenAiError(e: any): boolean {
  if (!axios.isAxiosError(e)) return false;

  const status = e.response?.status;
  // Retry on typical transient failures/timeouts.
  if (status === 408 || status === 429) return true;
  if (typeof status === "number" && status >= 500) return true;

  const code = (e as any)?.code;
  if (code === "ECONNABORTED" || code === "ETIMEDOUT" || code === "ECONNRESET") return true;

  return false;
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

  const retries = Number(process.env.OPENAI_IMAGE_RETRIES || 3);
  const timeoutMs = Number(process.env.OPENAI_IMAGE_TIMEOUT_MS || 120_000);

  let lastErr: any = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
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
          timeout: timeoutMs,
        }
      );

      const b64 = String((resp as any)?.data?.data?.[0]?.b64_json || "");
      if (!b64) throw new Error("OpenAI image generation returned no data");

      const out: GeneratedImage = {
        provider: "openai",
        prompt,
        dataUri: `data:image/png;base64,${b64}`,
      };

      cache.set(cacheKey, out);
      return out;
    } catch (e: any) {
      lastErr = e;

      if (!isRetryableOpenAiError(e) || attempt >= retries) {
        if (axios.isAxiosError(e)) {
          const status = e.response?.status;
          const data = e.response?.data;
          throw new Error(
            `OpenAI image generation failed (status ${status}). Response: ${JSON.stringify(data)}`
          );
        }
        throw e;
      }

      // Exponential backoff with a deterministic cap.
      await sleep(Math.min(1500 * Math.pow(2, attempt), 12_000));
    }
  }

  // Shouldn't reach here
  if (axios.isAxiosError(lastErr)) {
    const status = lastErr.response?.status;
    const data = lastErr.response?.data;
    throw new Error(`OpenAI image generation failed (status ${status}). Response: ${JSON.stringify(data)}`);
  }
  throw lastErr;
}
