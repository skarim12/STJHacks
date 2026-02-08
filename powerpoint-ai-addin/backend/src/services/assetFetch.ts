import path from 'node:path';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';

const cacheDir = path.resolve(process.cwd(), 'assets-cache');

const guessExt = (contentType: string | null): string => {
  const ct = (contentType ?? '').toLowerCase();
  if (ct.includes('png')) return 'png';
  if (ct.includes('webp')) return 'webp';
  return 'jpg';
};

export const fetchImageAsDataUri = async (downloadUrl: string): Promise<{
  contentType: string;
  dataUri: string;
  filePath: string;
}> => {
  const r = await fetch(downloadUrl);
  if (!r.ok) throw new Error(`Asset download failed: ${r.status}`);

  const contentType = r.headers.get('content-type') ?? 'image/jpeg';
  const buf = Buffer.from(await r.arrayBuffer());

  // Office.js addImage is sensitive to very large base64 payloads.
  // Keep a conservative cap here so auto-selection doesn't silently produce decks that can't be inserted.
  const MAX_BYTES = 4.5 * 1024 * 1024; // ~4.5MB
  if (buf.byteLength > MAX_BYTES) {
    throw new Error(`Downloaded image too large (${Math.round(buf.byteLength / 1024)}KB). Prefer a smaller rendition URL.`);
  }

  const base64 = buf.toString('base64');

  await fs.mkdir(cacheDir, { recursive: true });
  const ext = guessExt(contentType);

  // Content-hash caching: dedupe identical downloads across runs.
  const hash = crypto.createHash('sha256').update(buf).digest('hex').slice(0, 16);
  const filePath = path.join(cacheDir, `asset-${hash}.${ext}`);

  try {
    // Only write if missing.
    await fs.access(filePath);
  } catch {
    await fs.writeFile(filePath, buf);
  }

  return {
    contentType,
    dataUri: `data:${contentType};base64,${base64}`,
    filePath
  };
};
