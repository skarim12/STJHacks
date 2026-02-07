import axios from "axios";
import NodeCache from "node-cache";

export type SlideImage = {
  dataUri: string; // data:<mime>;base64,...
  sourceUrl: string;
  sourcePage?: string;
  credit?: string;
};

const cache = new NodeCache({ stdTTL: 60 * 60 * 24 }); // 24h

function clamp(s: string, max: number): string {
  const t = String(s ?? "").trim().replace(/\s+/g, " ");
  return t.length <= max ? t : t.slice(0, max - 1).trimEnd() + "…";
}

function safeQueryPart(s: string): string {
  return clamp(String(s ?? "").replace(/<[^>]*>/g, "").replace(/\bhttps?:\/\/\S+/gi, ""), 80);
}

function pickMimeFromUrl(url: string): string | null {
  const u = url.toLowerCase();
  if (u.endsWith(".jpg") || u.endsWith(".jpeg")) return "image/jpeg";
  if (u.endsWith(".png")) return "image/png";
  if (u.endsWith(".webp")) return "image/webp";
  return null;
}

function isWhitelisted(url: string): boolean {
  try {
    const u = new URL(url);
    return u.hostname === "upload.wikimedia.org";
  } catch {
    return false;
  }
}

async function wikimediaSearchFirstImage(query: string): Promise<{
  imageUrl?: string;
  pageUrl?: string;
  title?: string;
  descriptionUrl?: string;
} | null> {
  const cacheKey = `wm:search:${query}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached as any;

  // Wikimedia Commons search
  // https://www.mediawiki.org/wiki/API:Search
  const searchResp = await axios.get("https://commons.wikimedia.org/w/api.php", {
    params: {
      action: "query",
      format: "json",
      origin: "*",
      generator: "search",
      gsrsearch: query,
      gsrlimit: 1,
      gsrnamespace: 6, // File:
      prop: "imageinfo|info",
      iiprop: "url|mime|size",
      inprop: "url",
    },
    timeout: 6000,
  });

  const pages = (searchResp.data as any)?.query?.pages;
  if (!pages) {
    cache.set(cacheKey, null);
    return null;
  }

  const firstKey = Object.keys(pages)[0];
  const p = pages[firstKey];
  const imageinfo = Array.isArray(p?.imageinfo) ? p.imageinfo[0] : null;
  const imageUrl = String(imageinfo?.url || "");
  const mime = String(imageinfo?.mime || "");

  if (!imageUrl) {
    cache.set(cacheKey, null);
    return null;
  }

  // We only download from upload.wikimedia.org (direct file hosting)
  if (!isWhitelisted(imageUrl)) {
    cache.set(cacheKey, null);
    return null;
  }

  // Accept only image/*
  if (!mime.startsWith("image/")) {
    cache.set(cacheKey, null);
    return null;
  }

  const pageUrl = String(p?.fullurl || "");
  const result = { imageUrl, pageUrl, title: String(p?.title || "") };
  cache.set(cacheKey, result);
  return result;
}

async function downloadAsDataUri(url: string, maxBytes: number): Promise<{ dataUri: string; bytes: number; mime: string } | null> {
  const cacheKey = `wm:dl:${url}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached as any;

  const mimeGuess = pickMimeFromUrl(url) || "image/jpeg";

  const resp = await axios.get(url, {
    responseType: "arraybuffer",
    timeout: 8000,
    maxContentLength: maxBytes,
    maxBodyLength: maxBytes,
    headers: {
      // Wikimedia is friendly; keep it simple.
      "User-Agent": "STJHacks-PPT-AI/1.0 (deck export)"
    }
  });

  const bytes = Buffer.byteLength(resp.data);
  if (bytes > maxBytes) {
    cache.set(cacheKey, null);
    return null;
  }

  const contentType = String(resp.headers?.["content-type"] || "");
  const mime = contentType.startsWith("image/") ? contentType.split(";")[0] : mimeGuess;
  if (!mime.startsWith("image/")) {
    cache.set(cacheKey, null);
    return null;
  }

  const b64 = Buffer.from(resp.data).toString("base64");
  const dataUri = `data:${mime};base64,${b64}`;
  const out = { dataUri, bytes, mime };
  cache.set(cacheKey, out);
  return out;
}

export async function fetchSlideImageFromWikimedia(opts: {
  query: string;
  maxBytes?: number;
}): Promise<SlideImage | null> {
  const maxBytes = opts.maxBytes ?? 650_000; // ~0.65MB default
  const query = safeQueryPart(opts.query);
  if (!query) return null;

  const found = await wikimediaSearchFirstImage(query);
  if (!found?.imageUrl) return null;

  const dl = await downloadAsDataUri(found.imageUrl, maxBytes);
  if (!dl?.dataUri) return null;

  return {
    dataUri: dl.dataUri,
    sourceUrl: found.imageUrl,
    sourcePage: found.pageUrl,
    credit: "Wikimedia Commons",
  };
}

export function buildDefaultImageQuery(params: {
  deckTitle?: string;
  slideTitle?: string;
  bullets?: string[];
}): string {
  const parts = [params.slideTitle, params.deckTitle, ...(params.bullets || []).slice(0, 2)].filter(
    (p): p is string => typeof p === "string" && p.trim().length > 0
  );
  return parts.map((p) => safeQueryPart(p)).filter(Boolean).join(" ");
}
