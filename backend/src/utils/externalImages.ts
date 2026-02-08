import axios from "axios";
import NodeCache from "node-cache";
import sharp from "sharp";

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

async function wikimediaSearchFirstImage(query: string, thumbWidth: number): Promise<{
  imageUrl?: string;
  thumbUrl?: string;
  pageUrl?: string;
  title?: string;
} | null> {
  const cacheKey = `wm:search:${thumbWidth}:${query}`;
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
      // request a predictable thumbnail URL as well
      iiprop: "url|mime|size",
      iiurlwidth: thumbWidth,
      inprop: "url",
    },
    timeout: 6000,
    headers: {
      // Wikimedia APIs increasingly require a descriptive User-Agent.
      // https://meta.wikimedia.org/wiki/User-Agent_policy
      "User-Agent": "STJHacks-PPT-AI/1.0 (image enrichment; contact: local-dev)",
      Accept: "application/json",
    },
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
  const thumbUrl = String(imageinfo?.thumburl || "");
  const mime = String(imageinfo?.mime || "");

  const chosenUrl = thumbUrl || imageUrl;
  if (!chosenUrl) {
    cache.set(cacheKey, null);
    return null;
  }

  // We only download from upload.wikimedia.org (direct file hosting)
  if (!isWhitelisted(chosenUrl)) {
    cache.set(cacheKey, null);
    return null;
  }

  // Accept only image/*
  if (!mime.startsWith("image/")) {
    cache.set(cacheKey, null);
    return null;
  }

  const pageUrl = String(p?.fullurl || "");
  const result = { imageUrl, thumbUrl, pageUrl, title: String(p?.title || "") };
  cache.set(cacheKey, result);
  return result;
}

async function downloadAndCompressAsDataUri(
  url: string,
  maxBytes: number
): Promise<{ dataUri: string; bytes: number; mime: string } | null> {
  const cacheKey = `wm:dl2:${maxBytes}:${url}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached as any;

  const resp = await axios.get(url, {
    responseType: "arraybuffer",
    timeout: 10000,
    // allow fetching a bit larger, then compress down
    maxContentLength: Math.max(maxBytes * 4, 2_000_000),
    maxBodyLength: Math.max(maxBytes * 4, 2_000_000),
    headers: {
      // User-Agent required by Wikimedia policy.
      "User-Agent": "STJHacks-PPT-AI/1.0 (image enrichment; contact: local-dev)",
    },
  });

  const inputBuf = Buffer.from(resp.data);
  const contentType = String(resp.headers?.["content-type"] || "");
  const inputMime = contentType.startsWith("image/") ? contentType.split(";")[0] : (pickMimeFromUrl(url) || "image/jpeg");
  if (!inputMime.startsWith("image/")) {
    cache.set(cacheKey, null);
    return null;
  }

  // Compress deterministically to JPEG (good for photos; ok for most Commons images)
  // Target under maxBytes.
  let quality = 78;
  let outBuf: Buffer | null = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = await sharp(inputBuf)
      .rotate()
      .resize({ width: 1600, withoutEnlargement: true })
      .jpeg({ quality, mozjpeg: true })
      .toBuffer();

    if (candidate.byteLength <= maxBytes) {
      outBuf = candidate;
      break;
    }
    quality = Math.max(40, quality - 10);
    outBuf = candidate; // keep last
  }

  if (!outBuf) {
    cache.set(cacheKey, null);
    return null;
  }

  // If still too large, fail (caller will try fallback provider).
  if (outBuf.byteLength > maxBytes) {
    cache.set(cacheKey, null);
    return null;
  }

  const b64 = outBuf.toString("base64");
  const dataUri = `data:image/jpeg;base64,${b64}`;
  const out = { dataUri, bytes: outBuf.byteLength, mime: "image/jpeg" };
  cache.set(cacheKey, out);
  return out;
}

async function wikipediaSearchTopPage(query: string): Promise<{ pageId: number; title: string; pageUrl: string } | null> {
  const cacheKey = `wp:search:${query}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached as any;

  const resp = await axios.get("https://en.wikipedia.org/w/api.php", {
    params: {
      action: "query",
      format: "json",
      origin: "*",
      list: "search",
      srsearch: query,
      srlimit: 1,
    },
    timeout: 6000,
    headers: {
      "User-Agent": "STJHacks-PPT-AI/1.0 (image enrichment; contact: local-dev)",
      Accept: "application/json",
    },
  });

  const results = (resp.data as any)?.query?.search;
  const first = Array.isArray(results) && results.length ? results[0] : null;
  const pageId = Number(first?.pageid);
  const title = String(first?.title || "");
  if (!Number.isFinite(pageId) || !title) {
    cache.set(cacheKey, null);
    return null;
  }

  const pageUrl = `https://en.wikipedia.org/?curid=${pageId}`;
  const out = { pageId, title, pageUrl };
  cache.set(cacheKey, out);
  return out;
}

async function wikipediaGetLeadImage(opts: {
  pageId: number;
  thumbWidth: number;
}): Promise<{ thumbUrl?: string; pageUrl?: string } | null> {
  const cacheKey = `wp:lead:${opts.thumbWidth}:${opts.pageId}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached as any;

  const resp = await axios.get("https://en.wikipedia.org/w/api.php", {
    params: {
      action: "query",
      format: "json",
      origin: "*",
      pageids: opts.pageId,
      prop: "pageimages|info",
      piprop: "thumbnail",
      pithumbsize: opts.thumbWidth,
      inprop: "url",
    },
    timeout: 6000,
    headers: {
      "User-Agent": "STJHacks-PPT-AI/1.0 (image enrichment; contact: local-dev)",
      Accept: "application/json",
    },
  });

  const pages = (resp.data as any)?.query?.pages;
  const p = pages ? pages[String(opts.pageId)] : null;
  const thumbUrl = String(p?.thumbnail?.source || "");
  const pageUrl = String(p?.fullurl || "");

  const out = { thumbUrl: thumbUrl || undefined, pageUrl: pageUrl || undefined };
  cache.set(cacheKey, out);
  return out;
}

export async function fetchSlideImageFromWikipedia(opts: {
  query: string;
  maxBytes?: number;
  thumbWidth?: number;
}): Promise<SlideImage | null> {
  const maxBytes = opts.maxBytes ?? 900_000;
  const thumbWidth = opts.thumbWidth ?? 1600;

  const q = safeQueryPart(opts.query);
  if (!q) return null;

  const page = await wikipediaSearchTopPage(q);
  if (!page) return null;

  const lead = await wikipediaGetLeadImage({ pageId: page.pageId, thumbWidth });
  const chosenUrl = lead?.thumbUrl;
  if (!chosenUrl) return null;
  if (!isWhitelisted(chosenUrl)) return null;

  const dl = await downloadAndCompressAsDataUri(chosenUrl, maxBytes);
  if (!dl?.dataUri) return null;

  return {
    dataUri: dl.dataUri,
    sourceUrl: chosenUrl,
    sourcePage: lead?.pageUrl || page.pageUrl,
    credit: "Wikipedia",
  };
}

export async function fetchSlideImageFromWikimedia(opts: {
  query: string;
  maxBytes?: number;
  thumbWidth?: number;
}): Promise<SlideImage | null> {
  // Give ourselves a realistic budget so images actually show up.
  // PDF size will still be controlled by compression.
  const maxBytes = opts.maxBytes ?? 900_000; // ~0.9MB
  const thumbWidth = opts.thumbWidth ?? 1600;

  const raw = String(opts.query || "").trim();
  const base = safeQueryPart(raw);
  if (!base) return null;

  const tokenize = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9\s\-]/g, " ")
      .split(/\s+/g)
      .filter(Boolean);

  const stop = new Set([
    "the",
    "a",
    "an",
    "and",
    "or",
    "of",
    "for",
    "to",
    "in",
    "on",
    "with",
    "by",
    "from",
    "at",
    "as",
    "is",
    "are",
    "be",
    "this",
    "that",
    "these",
    "those",
    "how",
    "why",
    "what",
    "when",
  ]);

  const words = tokenize(raw).filter((w) => !stop.has(w));

  // Wikimedia search is sensitive to long, "prompt-like" queries.
  // Try a few deterministic fallbacks from most-specific → most-general.
  const variants = Array.from(
    new Set(
      [
        base,
        safeQueryPart(words.slice(0, 10).join(" ")),
        safeQueryPart(words.slice(0, 6).join(" ")),
        safeQueryPart(words.slice(0, 4).join(" ")),
        safeQueryPart(words.slice(0, 3).join(" ")),
      ].filter((q) => typeof q === "string" && q.trim().length >= 3)
    )
  );

  for (const q of variants) {
    const found = await wikimediaSearchFirstImage(q, thumbWidth);
    const chosenUrl = found?.thumbUrl || found?.imageUrl;
    if (!chosenUrl) continue;

    const dl = await downloadAndCompressAsDataUri(chosenUrl, maxBytes);
    if (!dl?.dataUri) continue;

    return {
      dataUri: dl.dataUri,
      sourceUrl: chosenUrl,
      sourcePage: found?.pageUrl,
      credit: "Wikimedia Commons",
    };
  }

  return null;
}

export function buildDefaultImageQuery(params: {
  deckTitle?: string;
  deckDescribe?: string;
  slideTitle?: string;
  slideDescribe?: string;
  bullets?: string[];
}): string {
  const parts = [
    params.slideDescribe,
    params.slideTitle,
    params.deckDescribe,
    params.deckTitle,
    ...(params.bullets || []).slice(0, 2),
  ].filter((p): p is string => typeof p === "string" && p.trim().length > 0);

  return parts.map((p) => safeQueryPart(p)).filter(Boolean).join(" ");
}
